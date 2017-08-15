# Tributary: Consuming Urban Airship Connect on Behalf of a Customer

> A tributary is a stream or river that flows into a larger
> stream or main stem (or parent) river or a lake. A tributary does not flow
> directly into a sea or ocean. Tributaries and the main stem river drain the
> surrounding drainage basin of its surface water and groundwater, leading the
> water out into an ocean.

Urban Airship Connect is a streaming HTTP API which provides near-real-time
mobile event data. The goal of the project is to give customers access to the 
user-level data that we collect on their behalf and enrich with additional
information. However, many customers don't want to spend the resources on a
bespoke pipeline from our API to their analytics engine. Enter Tributary, which
takes the stream of data into the ocean of third-party  analytics, data storage,
and marketing tools.

## Overview

Tributary is a distributed system that can scale arbitrarily with customer
demand. It's functionality is split across hardware nodes on our internal VPN, 
and AWS hosted services. It relies particularly heavily on Amazon Web Services
Elastic Cloud Compute Service (AWS ECS), which essentially ensures that the docker
containers you'd like to be running are. This doesn't guarantee that your
processes are running: ECS can fail to find a node that has enough resources to
fulfill your specification, or configuration errors might prevent the process
inside the docker container from ever doing any work, but it does mean that you
can just shutdown the process in case of exception, and be confident that it
will get started back up again. 

ECS is a great fit for this application because it means we can represent each
integration as one or more processes (we could set the service up to start
multiple tasks if needed), each of which can start/stop as needed. We don't need
to shut down on each exception, but if we do it's not a big deal-- we just start
up again from the last offset for which we uploaded data. This is a nice way to
write software-- if we need to move to different nodes or deploy the system, we
can do so without fear, since restarts happen all the time anyway. It also means
we can scale arbitrarily. A single JVM can do a ton of work, but because of our
environment, if we ever had a customer large enough to require more,
implementing a sharding strategy that split consumption among a number of nodes
is straightforward.

Using ECS does introduce some complications as well. For example, logs and
metrics need to be exported from your docker container in a fashion that will
work consistently across the cluster. We push logs and metrics into an AWS
Kinesis queue. AWS Lambdas subscribe to these queues to transform and insert
logs and metrics data into Influx DB for visualization, Elastic Search for
convenient access, and AWS Kinesis Firehose for long term storage.

It's architecture diagram looks something like this:

```

 +----------------------------+
 | Customer-set Configuration |
 +-------+---------------------+
         |
         |
         |
         |
   +-----v------+
   |            |
   | Controller |
   | Service    |
   |            |
   +------+-----+
          |
          |
          |
    +-----v-----+            +-----------------------+
    |           |            |                       |
    | AWS ECS   |            |                       |
    | Services  <------------+ Urban Airship Connect |
    |           |            |                       |
    +-----------+            |                       |
    +-----------+            +-----------------------+
    +-----------+
          |
          |
          |
          |
   +------v--------+
   |               |
   |  Third Party  | 
   |    Systems    |
   |               |
   +---------------+

```

## Controller Service

The controller service starts and stops integration instances on a customer's
behalf. It records the desired state in a dynamo table, makes calls to ECS to
start up integrations, and then periodically checks the state of the instance
to see whether everything is peachy. 

## AWS ECS Services

Each customer-configured integration is represented by a single AWS ECS Service. 
Each service consumes from Connect, possibly transforming connect events into
the format needed by the third party, and submits the request with retry to the
third party. Each service keeps a record of its Connect offset, its start up
history, any exceptions its encountered, and whether it thinks it is lagged in a
dynamo table. 

It poblishes its metrics and logs into a kinesis stream, together with all the
identifiers needed to disambiguate it from its sister services. This is
burdensome for our metrics system, since it results in hundreds of time series.

### Monitoring

Originally each service could page us as it ran into issues, and would resolve
pages after successfully uploading again-- basically if it can do its job the
issue can be considered resolved. However since we run a service per 
integration, and each customer can have many integrations, this leads to some
problems. For one thing many exceptions are transitory-- they resolve almost as
soon as they fire because they were due to a network error (networks are
unreliable), or due to receiving a bad node from AWS EC2, and the problem
resolves as soon as the task gets moved onto a different node. If there really
was a problem, we'd get literally hundreds of pages all at once, which really
isn't helpful.

The problem is basically that each service has no concept of what's going on in
the rest of the system. It knows that it encountered an exception, but has no
way of knowing whether the equivalent exception has already been encountered,
if exception is new, or even if a previous process running the same code with
the same configuration already encountered it. Moreover, we're now in the
business of classifying exceptions-- if the exception is due to customer
misconfiguration, all we can do is tell the customer about it and hope they fix
it. There's literally no recourse but to keep trying. If it's a network error,
we just want to keep trying until the network comes back (although because its
virtualized commodity hardware, we shut down so that ECS can spin us back up
again on a different node).

To some extent we can't get away from categorizing exceptions. It's just part of
the job. However we CAN avoid spuriously waking somebody up. Tributary now
follows these guidelines for monitoring:

1. Use sentry.io
    
  Sentry is an error aggregation service that does black magic to aggregate
  errors and only notify you of new ones. It's a lifesaver in a situation like
  this, because it makes us aware of what's going wrong without waking anybody
  up or flooding your logging system with noise. You can set it up to send you
  an email when it encounters a new exception, which makes the process of
  deploying and then fixing whatever bugs result much more relaxing than when
  you get around 200 pages each for the same exception, or at looking at logs
  suddenly full of error traces.

2. We don't really have a problem unless a lot of services are experiencing a
   problem

   Urban Airship sells Connect as part of an e-commerce package now. A lot of
   people sign up, and small apps tend to exhibit weird behavior when it comes
   to consuming connect. They may not consume for a long time, then have a small
   burst of messages, and then go back to not consuming for a while. They may
   have such a small amount of traffic that it takes several hours to fill the
   GZIP buffer (Connect is gzipped by default, because it is optimized for
   apps on the larger side). This means that when they do consume they'll think
   their lagged for a few moments before getting to recent data. 

   Moreover, once you get enough services running, you're basically guaranteed
   that a couple are always going to be in a wonkey state for some amount of
   time, whether due to network unreliability, unexpected client errors (I'm
   looking at you AWS S3: `We encountered an internal error. Please try again.
   (Service: null; Status Code: 0; Error Code: InternalError; Request ID:
   00090C0A4CA19DB0)`, or customer misconfiguration. Rather than try to
   categorize all the problems an integration might come accross, it's better to
   just to record that the service fulfilling integration #2 for a given app has
   encontered an exception, and report the exception to sentry. 

   The converse of this rule, "If a lot of services are experiencing a problem,
   then we have a problem" means that we need something that periodically scans
   the table where exceptions encountered by tasks are stored, and makes a
   determination about whether or not the system is healthy. If a lot of
   services are in a problem state, it's certain that something somehwere is
   wrong and requires human intervention.

2. It a service consuming for an app with a large audience has 
   a problem, then we have a problem.

   The above rule almost always holds true, unless the problematic integration
   is particularly reliable or important to the success of the produce.

   Large apps fulfill this criteria:

   - Connect is optimized for large apps, a large app having problems is
     likely to be a real problem. 
   - Large apps make up a substantial portion of the income the project
     generates. A large app choosing not to renew their contract impacts our
     bottom line. 
   - Large apps are unlikely to configure their integration incorrectly, since
     if they do they are likely to complain (since they expect a higher quality
     of functionality given the cost of their subscription).

The goal is to never page unless the problem is real, but also to make sure we
know when something is wrong. I think this balance does that-- intermittent
issues are surfaced by sentry, on a timeline that is convenient for the
developer. Major issues are surfaced immediately by our system level alerting.

## Conclusion

Tributary is an interesting system. The pattern of starting and stopping a
process in response to a customer's request is a new pattern at Urban Airship.
Historically, we've run a number of JVM's which consume a work queue, which
contains work items for a large set of customers. The process of maintaining,
and getting woken up by tributary has taught us a lot about this alternative
architecture. It has largely been a lesson in the value of keeping your system
laconic-- alert too much means the engineer on-call simply ignores the
alerts, since they don't actually indicate that anything is wrong. Keeping this
system sufficiently laconic turned out to require a database for the state of
the system, and sentry for exception aggregation (which itself requires a
database). What we really want to do is report on the state of the system as a
whole, but also catch and handle new exceptions that might indicate real
problems, or which simply indicate we need to contact the customer. 
