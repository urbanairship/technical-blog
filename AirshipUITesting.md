# UI Testing at Urban Airship

By Andrew Winterman

As consumer expectations of web interfaces grow, more of the logic making the website go needs to move to the front end. In other words, code is sent to the customer. 

As the customer interacts with the page, the code executes, providing near instantaneous feedback, and smoother interactions with the product. 

For example, rather than wait for form validation (e.g. checking proper formatting of an email address or phone number), the validation code can execute as soon as the user makes a change.  


Like any other piece of software, this code is subject to error. If the website is simple, and the variety of browser it must support limited, then it might be sufficient to test manually. That is, opening the interface in the target web browsers, and clicking around until all the features of the website have been exercised and their correctness verified. 


If the website is complex, then the combination of features can grow beyond the ability of a human to test. 


The most complex parts of your website are probably also what set it apart from your competition. For Urban Airship, this has historically been our Push composer, which provides a unified interface for composing a push notification. It allows customers to:
* write html templates
* define complex actions in response to a push
* set conditions under which a push should be automatically delivered
* make a complex audience selection, and 
* establish the notification schedule for a message. 


It also provides instantaneous validation of the above, a preview of how the notification will appear on a variety of operating systems, and guides the user away from invalid selections.
 
A feature set this complex is impossible to test manually, but if it breaks, our ability to deliver the product looks questionable. A broken interface is a terrible experience for the user, especially if that interface controls how millions of customers view and interact with your brand.


Complex, modern interface front ends need an automated testing strategy which helps engineers to safely and quickly make changes. 


At Urban Airship, we have developed a strategy both for writing front end code in a testable manner, and for writing tests that cover the breadth of features exposed in our web interface. 


In the following series of posts, by myself and Nate Wittstock, we will:


* briefly cover how our website is built
* discuss our legacy testing framework
* describe how we decided to discard and replace that framework
* discuss some of the characteristics of testable front end code under our new testing framework
* the consequences of that decision.

________________

## A Cage of Our Own Construction

Urban Airship’s website provides advanced reporting, audience management, and push messaging functionality. 

On the front end, it is a constellation of node-style small JavaScript modules browserified into bundles, which gets shipped up to make the various pages on the site run. On the backend, it is a Django app that dictates which bundle entry point should be called on each page and proxies requests to internal, Urban Airship services. 

As the website has grown in complexity, testing has grown more and more important. The number of combinations of features in our push composer alone now boggles manual testing. Even as we modernized other sections of our stack — moving from require.js to browserify, for example, our testing setup remained distinctly vintage. 

Since then, we’ve gone through the interesting process of transitioning from a vintage, NIHed, mocha-like testing setup, to a modern testing setup that relies on a series of small modules.

### Out With the Old

Our previous solution was called drive.js. It was probably a totally reasonable solution at the time it was written, but as time went on, it grew less and less popular among the developers tasked with using it, especially as easier to use and understand solutions became popular in the open source community. 

Last year, between product development projects, I was able to secure managerial cover for embarking on the project of replacing drive.js with something more modern and developer friendly. 

Because changing testing solutions is difficult, It was very important to me to get it right the first time. We’d have to change hundreds of tests, thousands of lines of code, and even touch the manner in which code was run on the website.

Any technology choice can be  a trap. Change is expensive and carries risk—both because technologies don’t always fulfill up their promises, and because the transition can be error prone. 

Moreover, In the event of an error or an audit of how we spent engineering resources, we need to be able to point to our reasoning. We need to be able put our new world in the context of where we came from. 

### Motivate Change: Identify Technological Risks and Benefits with Pre-Development Reviews

We’ve been using a "pre-development review" process — a concept borrowed from the construction industry to solicit stakeholder input before they break ground — to screen proposals for problems and to involve the whole team in the decision-making processes. Senior engineers can weigh in with their experience; junior engineers can learn about our motivations and standards. 

The process is simple: The proposal is written down and submitted to code review. After it receives the approval of an appropriate proportion of the team, the proposer can begin work. 

In this case, the goals of the project dictated the structure of the development preview: We had to describe the requirements of an effective testing framework, recount the problems with the old system, and provide a criteria by which we evaluate any new proposal. We needed to evaluate the available options, and select a course of action.


Our pre-development review, after its PR review, and slightly edited will be included in our next post. It includes our decision-making criteria, an evaluation of the options available at the time of its writing, and our conclusions.
________________


## JavaScript Testing At Urban Airship

JavaScript does not run in a vacuum. It often expects to be able to interact with other computers over a network, and to have a certain Document Object Model (DOM) available when it loads.These expectations can be onerous, especially if they are implicit, undocumented, and hard to figure out. 

One important page on our site expects a script element with a JSON blob of permissions and templates, another element with a JSON blob representing a partial model object representing user input, and a parent DOM element into which it will render itself. 
As far as APIs, the page needs to post partial model objects to one endpoint, completed model objects to another, and fetch available options from at least three separate REST resources. 

All of these expectations are implicit. Many are encoded in the index module responsible for rendering the page, but others you won't discover without combing through the dependency graph. Despite its complexity, it has dependencies that can be enumerated and mocked out.
Our JavaScript itself also has implicit requirements. For example, we expect JQuery to be available on the window object before any JavaScript runs. We "compile" our JavaScript with browserify, and a few transforms—some custom, some community maintained —that allow us to require .html files as plate templates and .ract files as Ractive templates. Without browserify, the transforms, and these extra modules, no code can run.

This means that testing can be non-trivial, even after a best-effort to write modules with testability in mind. We need to be able to:

* write tests in a clear and standard fashion
* mock network interaction (we're not writing integration tests (yet), but rather unit and functional tests)
* safely and cleanly supply a DOM while a test is running
* make sure each test runs in a pristine environment
* build tests and the code they target in a manner closely matching production

Any JavaScript testing setup will address these requirements. Our current test runner, drive.js satisfies most of these requirements, but it has some significant issues, partially documented in its github issues. 

In short, it's a single abstraction that attempts to fulfill all of our testing requirements. It does a mediocre job at fulfilling all of them, and causes significant developer pain besides. A partial enumeration of the problems follows:

1. Only a tiny handful of people (us) use it.
2. It is complex — of the tiny handful of people who use it, even fewer understand how it works.
3. It is written in a confusing fashion. Even those who know how it works have difficulty changing it.
4. The documentation has proven to be incomplete — I recently spent a week investigating how to implement a feature that already exists, but was a poorly documented.
5. It squelches error output. This is a hard problem and not entirely drive's fault. However because of the points above, it is difficult for us to address this problem.
6. There's no way to differentiate remote procedure calls pertaining to running of tests from client HTTP requests — it supplies certain resources for itself with the expectation that code under test won’t need to mock out resources at the same URL.
7. It's impossible to require external modules when mocking out HTTP resources. Drive overrides the require function in its endpoints context, and endpoints is extracted from the file in which it is defined for execution elsewhere, meaning it is impossible to refer to values from the enclosing scope. This means that reusing mock endpoints or maintaining a fixtures directory is impossible.
8. Drive isn't designed to handle absolute URLs, despite the fact that the code under test is at liberty to make full use of them. There is a work around, but it was poorly documented until very recently (see point 4), and is unpleasant to use, besides.
9. It was designed to solve a problem we no longer have. It makes cross browser testing easy, but we instead rely on well used and verified client code to abstract away browser differences, including an es5-shim and JQuery.
10. Drive has a few error states that cause it to hang silently. Developers are left to binary search through the code under test, AND its dependencies, looking for the cause of the issue.
11. Because of its tiny community of use, we're still discovering errors several years on.
12. Much of the functionality is accomplished via AST transforms and string manipulation of the test file.
13. Drive is universally unpopular among Urban Airship’s JS developers. We've agreed among ourselves at team meetings on the necessity of replacing it.

### The Solution: Moving to Community Standards

There are now better solutions available to use. Drive.js solved a hard problem when there weren't many suitable alternatives available. As a long term goal, we want a solution that is:

* Modular: The pieces should be well defined, comprehensible, and isolated from one another.
* Established: There should be a strong community of users who are facing the same problems we are.
* Communicative: It should say what it is doing clearly. Developers should never have to binary search through the code under test.

Pieces to the problems:

* Test Harness
* Test Runner
* Mock XHRs
* Sanitary DOM usage
* "Compiling" code

#### Test Harness:
A test harness should provide utility for writing tests, handling asynchronous testing targets, and sending output to the console.

##### Drive.js
Drive does an alright job of this — it was inspired by Mocha, a very popular testing framework. However, it implements its own assert module, which is completely undocumented. It supports asynchronous testing targets via an optional parameter to a test function. A drive test looks like:

```javascript
suite('a suite of tests', function() {
 test('my coolest test', function(done) {
   setTimeout(function() {
     /* some cool testing */
     done()
   }, 0)
 })
})
```

If `done` is called without argument, the test will complete successfully. done may be called multiple times.

#### Tape:

Tape is a very small, relatively simple module by substack. It provides a test harness and generates TAP compliant output. My impression is that tape is the defacto testing standard among node developers who embrace streams to the degree we do.
Its testing format is not terribly different from Drive’s. A tape test looks like:

```javascript
var test = require('tape')

test('my cool test', function(t) {
 t.plan(3)
 t.equal('cool', retursnCool(), 'cool is cool')
 t.notEqual('is this', 'that', 'this is that')

 setTimeout(function() {
   t.ok('made it!')
   t.end()
 })
})
```

tape provides two methods for ensuring that the test has executed all the tests it was expected to: t.plan which specifies that all the tests that needed to be run have been run, and t.end, which says "this test is finished." If t.end is called more than once, then tape throws an exception. If the number of assertions made before the test finished executing does not equal the number planned for, tape throws an exception.

Tape has the advantage of JUST being a node module. We could theoretically run tape tests via drive — simply requiring the test file inside of a drive Suite. This means that we can use Tape, and then choose best-in-class solutions for the other problems we face.
Tape also provides a pluggable interface for reporting test results. There's a small constellation of modules providing alternative reporting. The functionality that enables this could be leveraged to provide setup and teardown functionality, or with CI to notify developers more aggressively when their changes break the build.

#### Conclusion
We decided to use tape. I wrote an AST transformation in my free time that accomplishes most of the grunt work. It cannot update drives html or endpoint calls, since tape does not support the same functionality, and the transformation does not make any assumptions about the solution to this problem.

### Test Runners

A difficult aspect of writing code for the client is our lack of control over where the code executes. The system that determines our capabilities in this respect is a test runner. We evaluated a number of options, each of which is described below:

#### Drive

Drive was designed specifically to be flexible in this regard. It sets up a server which clients running any browser (from Lynx to Google Chrome to PhantomJS) can connect to. Drive sends html and javascript to the client, and forwards the results back to the console from which it was invoked, as well as reporting them in the client. Its implementation of this has some serious flaws. It juggles a lot of state between server and client, uses a poorly documented rpc library in addition to XMLHttpRequests, implements a small web framework, and uses an undocumented DSL to communicate between client and server. The problems involving crossing of channels originate in this chunk of code.

Our actual usage eschews drive's functionality as a test driver — we almost always run our tests in JSDom, a userland implementation of the DOM in a node.js environment. This is nice because it keeps our prerequisites down, but it means that our tests run in a fake browser
— nobody uses jsdom to browse the internet. Bugs we find via running tests there may or may not exist in real browsers.

#### jsdom-eval

This is a ~80 line module that Michael Hayes wrote and maintains. It has a very simple API — you can specify a js file and/or an html file, and it will set up a jsdom environment with the html, and run your js. The only trickery it engages in is to support source-mapped stack traces, but as of version 0.0.8, it falls back to regular stack traces if the sourcemap fails to satisfy expectations.
jsdom-eval only ever runs tests in jsdom.

I've spent some time getting tests running in jsdom-eval. It works. Exceptions in the tests themselves can sometimes yield unwieldy tracebacks, but getting it going and understanding what jsdom-eval is doing are both relatively easy. It's possible we could find a way to improve its error reporting as well, perhaps via tracekit

#### testling

Testling is the software at the heart of one of substack's commercial endeavors. It uses a module called browser-launcher to run tests in a variety of available browsers. It is designed to do cross browser testing, and probably does a reasonably good job of this. We found it did not match our usecase well — it is difficult to supply an html scaffold for testling to use, and it is impossible to specify test specific options to browserify. It's difficult to specify a specific html file to use as the DOM when running the tests. When a test failure occurs, testling isn't helpful in determining the line originating the error. I don't think it supports sourcemaps, at all.
Moreover, the project isn't very friendly to contributors. It is hastily written, subject to competing demands (it supports mocha specifically for some reason), and the author, substack is a bit of a node celebrity. The repository itself has quite a few open issues, of which many are over a year old or have no responses from the maintainer, or both.

#### phantomjs/slimerjs headless browsers

phantomjs is an old webkit, repackaged to run headlessly. It's kind of janky — it has its own module system which you can use to interface with the browser. It is also not a "real" browser in that the webkit version it uses is vintage and hard to upgrade. It doesn't have es5 functional primitives for example.

We'd have to write our own test runner if we want to run tests in this environment. As evidenced by jsdom-eval, this is a simple task, but it means one more piece of code nonetheless.

I talked to our Operations team briefly about getting phantomjs on our CI worker machines. It sounds like it could be difficult to package, and would require some dedicated time from an Ops person.

#### Conclusion

While we would have liked to use a headless browser implementation, like phantomjs or slimerjs, such a choice would have involved writing our own test runner, since no such runner existed. Additionally, we would have had to harness resources from our over-worked Operations team in order to accomplish the switch.

Instead, we switched to jsdom-eval on a short-term basis and added implementing phantomjs-eval and/or slimerjs-eval to the backlog. We knew that once Operations had the person-hours to help us switch, we could simply update the npm test command to run our tests in those environments as well. 

### XHR mocking

In order to satisfy the expectations of a module, we may have to provide the proper response to http requests. There are a number of approaches to this problem.

#### drive

Drive actually makes network requests. It sets up a node http server to service them. The user can supply responses via the endpoints function, which takes as its argument a mapping between relative urls and node request handlers. However you cannot require inside the request handlers, and they are pulled out of the enclosing file to be executed on the server, so you also cannot refer to variables from enclosing scope. This means mocking out complicated or large responses is unwieldy, and that it is impossible to reuse code between mock responses.

Drive can support arbitrary urls via endpoint rewriting.

jsdom doesn't actually support the full range of `XMLHttpRequests`. It relies on a node module, npm.im/XMLHttpRequest wich attempts to implement the spec on top of node. This module is not the best. It doesn't support any HTTP verb apart from GET. It throws strings when it encounters an error, which means that the error has no stack trace. The project is not maintained — the version of the module on npm does not match any version tag in the public github repository. It has a huge number of open issues and prs, none of which have comments from the original maintainers, so it doesn't seem as though it will get better any time soon.

#### sinon

sinon is the only alternative I've explored so far for mocking network interaction, because it's really very good.
It mocks network interaction via a fakeServer and overriding the `window.XMLHttpRequest` object with a mock. The mock is really very good — it seems to support every case I've tried so far.

Your register listeners for certain routes via the fakeServer respondWith method. respondWith is overloaded. It can take:

* an array of status code, headers, response body
* a url and an array of status code, headers, response body
* a http parameter and an array of status code, headers, response body
* a function that takes the XMLHttpRequest object as its parameter. The XHR object also has a .respond method, which you can use to specify the status code, headers and response body. This function CANNOT be asynchronous, however a mechanism for asynchronous responses is available on the server itself.
* a url and a function as described in the preceding bullet.
* a http parameter, a url, and a function as described in the preceding bullet.

Once you've issued requests, you can queue the server to respond to all the requests it's received via a server.respond method. This is a little clunky, but so far it's been sufficient even for relatively complex tasks. Some code may require minor rewrites in order to be testable under this pattern, e.g. code that involves chained requests that follow next-page headers until they have retrieved all the data.

I'm pretty happy with this solution. The community of use is large, and the code base is under active development. The velocity of development is reasonable — they seem to merge changes every two weeks, and have a roadmap for 2.0.0 that seems appropriate to me. The code base is not the most readable ever, but it's not so bad as to dissuade me from using it.

Using the fake server and mock XMLHttpRequest require setup and teardown — we need to override the XMLHttpRequest object with the sinon mock, instantiate the server, and register routes during setup for each test, and we need to wipe the registered routes, and restore the xml object during teardown.

### Sanitary DOM usage

Modules have expectations about the DOM. We need to set up a DOM that satisfies these expectations before we begin, and then tear it down after we finish.

Drive.js accomplishes this by simply running each test suite on its own page. Tape doesn't really have a "suite" abstraction, so it's up to us to setup and teardown the DOM before and after each test.

Jesse Keane wrote a ~20 line module that would handle this logic for us. It's called dom-sandbox, and accomplishes exactly what we need here. You supply html, and it renders it to the dom, returning a parent element if needed. dom-sandbox exposes a .destroy method, which removes the element from the DOM. You can only have one sandbox at once.

### Setup/Teardown for tape tests

We want to be able to easily specify setup/teardown for a file. The usual case is all the tests in a file expect the same DOM (each test file tests a single module).

I investigated the following:

* wrapping-tape
* redtape
* pre-tape 
* tape-suite
* taped

Most of these take a fairly hacky implementation towards adding setup/teardown. They either bracket each test in yet more tests, or involve relying upon undocumented features (which means a point release could break our software.

We should simply use tape's builtin ordering of tests to add setup and teardown tests. These look like:

```javascript
test('setup ' + __filename, function(assert) {
 // set up code goes here.
 assert.end()
})

test('teardown ' + __filename, function(assert) {
 // teardown code goes here.
 assert.end()
})
```

### "Compiling" Code

Currently, our test bundle is created by invoking a long bash command which attempts to mimic the how we bundle JavaScript for production. Our production bundle is created by a node script that depends on browserify as a library. We should use the same build script for both test and production cases, if at all possible. The bash command for the test bundle does not permit bundling a single test — users must use the drive.js command line API to run a single test.

We should also make sure the npm test command can be used to run a single file — npm test foo.test.js should run just the foo.test.js file.

This problem is very specific to our use case, and I think is best accomplished by wrapping or updating our production script to also work with tests.

### Conclusion

This proposal boils down to the following constellation of tools:

1. test harness: tape
2. keeping the test environment pristine: convention and manual clean up after test completion.
3. sanitary DOM usage: dom-sandbox
4. test runner: jsdom-eval 
5. XHR mocking: sinon
6. “compilation”: existing production script (as much as possible)


________________

## UI Testing at Urban Airship: Implementation

In our previous post, we discussed our requirements for a testing solution, the problems with the existing solution, and proposed an alternative solution, which we ultimately implemented. The process of doing so was treacherous and tedious. I spent a long time in the weeds, but got there in the end.

The AST transform mentioned in the previous section, drive-to-tape, was immensely helpful. However a lot of work still remained: 

* The semantics of tape’s t.end function differ from drive.js’s done, which required manual intervention and careful thought. 
* Any use of the endpoints or html, also required refactoring. 
   * Invocations of html could simply be replaced with require statements and a browserify transform to define how to translate an HTML file into a web page

Lastly, because we were running every module in the same page, we encountered some interesting corner cases that were covered up by our former test runners. These may or may not have bitten us in production — they’re characterized by spooky-side-effects at a distance which break under certain combinations of factors, as opposed to an easy-to-find point and click bug.

Essentially, running one test could sabotage another. We considered writing tools to find the minimum set of test interactions that causes a failure, but the complexity of that task outweighed its benefits. 

The problem arises from the fact that the code under test was written without the constraint that it clean up after itself, and some of our modules did not do so at all. As a result, we had to do  some refactoring of production code in order to make it testable.
The problems fall into the following categories:

### Silently Queueing XHRs

If a module silently schedules XHRs for future turns of the event loop, then there's no way to write a test that can clean up after itself. Moreover there’s no way the test will ever end. Node or Phantom will keep running until all the scheduled activities have expired.

To solve this problem we either:

* rewrote the code under test to accept a mock, which it used to make the request, or 
* rewrote the code under test to provide a shutdown hook, and to emit an event when it finishes its tasks. 

In production the real request module would be passed in, but in tests the mock would provide hooks to ensure that the right request was made at the right time.

### Polluting the DOM

This is problematic because tests of DOM interaction consist of tickling a DOM node (clicking on it, mocking input to it), and making sure that the module laughs appropriately. 

If a module under test is required by another module, and leaves its elements in the DOM, there's no way to know which element corresponds to which instance of the module. There’s no guarantee that modules which rely on the poorly behaved module will function in this scenario, and as a matter of fact we encountered several where they explicitly assumed there’d be only a single DOM element matching a CSS selector. Breaking this assumption broke the module.

We refactored such modules to either present an API that allows you to pass in an element that they will mutate, or to have a .destroy method which removes any elements the module had to introduce. 

### Global Event Handlers
Modules that add event handlers to window, document or body should also remove them on teardown. Otherwise unanticipated side effects can occur when those actions are fired. This can cause memory leaks when running the thousand or so tests we have defined, or lead to unexpected failures. We simply had to add .destroy methods to these modules as well.

### Defining Behavior on `require`

`require`d modules execute exactly once.

This is nominally fine — most modules aren't required multiple times, and those that are don't export values that change between the requires. For example, we have two modules that essentially extract information from the URL. They don't change unless you navigate to a new page.

Exactly once require does cause issues for tests. For example, we have a module that instantiates a popover on require. If it is required twice in the same test bundle, they will both have reference to the same popover. This means that the first instance cannot clean up after itself without breaking the second instance.

We updated these modules to export a function. No execution happens until the function is called.

### Solutions:

Essentially, writing modules to be testable boiled down to the following:
* Modules should export a function which defines all of their behavior.
* If it needs to accomplish any asynchronous task, the return value of the function should emit an event or call a callback when it has finished any asynchronous tasks.
* If a module manipulates the DOM, either by adding event listeners or dom elements, it should also define how to clean up after itself.
In some cases, it wasn’t possible to update production code to satisfy the above criteria. When that happened, we mocked the offending modules with proxyquireify when testing any of its dependents.


# UI Testing at Urban Airship: Further Improvements

_By Nate Wittstock_

Above, we discussed our transition from drive.js to tape; these posts covered the transition between test runners, how we replaced built-in mocking functionalities that drive.js provided, and the implications for how our tests and modules were written. At this point, the state of our world was:

* tape as our test harness
* sinon for xhr mocking
* proxyquireify for dependent module mocking

When we started this process, our goals were to:

* Replace NIH ("not invented here") components in our testing stack
* Ease of replacing and upgrading components related to testing and deployment
* Ability to use multiple testing environments without code changes

We had made substantive progress, but there were still challenges to come, and simplifications to be made. One of the requirements that we'd set for replacing our test harness was the changes required to our actual code should be minimal— if any at all—and that it should not modify our production build process. With the harness replacement out of the way, we had good running tests in the new environment. This freed us from those requirements, and we could kill some more NIH.

## Replacing the Bundler

At Urban Airship, we use Browserify to "compile" our Javascript. Browserify is a series of transforms, utility modules, and tools that allow you to write front-end Javascript with Node.js-like require, and writing against a Node.js-like API, but for the browser. When you deploy your front-end javascript, Browserify transforms your codebase into a single Javascript "bundle", so it can be run in a web browser.

Browserify provides a fully featured command-line interface to do this, but we weren't using it. Instead, we had our own bundler script that did a whole suite of things. Before explaining why we had our own bundler and how we replaced it, it's good to understand how we've structured our pages and the implications on module loading.

## Entry Points, Modules, and Pages

When you’re building a Browserify project, it's common for you to have a single “entry point”—that is, the code that actually runs when the module is loaded. With Node.js modules, evaluation happens at require time; the first time they are required, any Javascript that is in the module's body is executed, and the resulting module is returned. As such, if your code is wrapped up in modules, just including them on the page doesn't actually run them, you need a bootstrap script to kick it all off!

In Browserify, these are referred to as "entry points"; these entry points are pieces of code that are not wrapped up in a module, and are executed at the time that the page loads.

If you're used to writing for Node.js, an entry point won't seem strange, just as you'd run node app.js to start your app, the entry point is the code that gets run on the page as soon as the bundle is loaded. The trick with Browserify is that you can have multiple entry points, which are run in the order that they are defined.
An aside: how page modules work

While a more single-purpose web application—like a chat or a to-do app—might be well-structured as a monolithic single-page app with one entry point, the Urban Airship dashboard has many purposes: message composing, reporting, billing, etc. To support this we have many single-page applications across the site that use shared sets of modules, but all of the applications are served from a single bundle. To achieve this, our single entry point is a conditional module loader called load-bundle, which determines which module must be loaded based on context written into our pages.

However, some modules should be loaded across every page; we call these behaviors and load them unconditionally as part of the load-bundle script.

While this isn't necessary to understand the task at hand, it's worth noting that these two things were previously separately managed concerns, each being added as distinct entry points (along with our third-party dependencies) in our custom bundler.
Back to bundling: replacing the bundler

Our custom bundler did a number of things for us:

* Set entry points for our third party scripts and behaviors, so they were executed on every page
* Perform the actual bundling via Browserify's API
* Perform sourcemap transforms, and strip sourcemaps out of the bundles
* Act as a development server, serving the bundle for our local development environments, and watching the filesystem to rebuild on changes
* Act as a test bundle server for running tests in a browser (in CI, our tests were still run in in jsdom)
We decided early on that we needed to rely on the Browserify CLI, and avoid using its API programmatically; Browserify's most common use-case is via the CLI, and using it directly would make future upgrades far easier for us, versus relying on a possibly unstable and chaning API.

## The move to npm scripts
(Figurative) wars have been fought over build tools; with the merits of task runners, gulps, grunts, broccolis, et al. Without starting a fight: we fell on the side of fewest complexities, and decided to use npm scripts along with CLI tools that supported piping via the shell.

Lets go over the commands we use, one at a time:

### Running our local development server

When we develop locally, we have several systems running on our local machines (see the blog post our frock-blog, one of our open sourced development tools, for further details). We serve our bundle using a fantastic tool called `budo`:

```bash
budo ./scripts/load-bundle.js:bundle.min.js --verbose --port 8008 -- --debug
```

What this does is Browserify all of our dependencies and serve our bundle (using load-bundle as the entry point) to our local environment. budo includes a file watcher which progressively rebuilds the bundle when changes occur. This bundle includes a source map, which helps to contextualize any errors we may see during development.

Prior to using budo, we were using [beefy][]; a similar tool, but with some drawbacks (namely, it serves stale bundles while a new bundle is being built). Our ease in replacing beefy with budo was actually a huge validation of the process we went through to get here: it only required installing one, removing the other, and updating the CLI above.

### Building our bundle for production

When we actually build our production application, our build process is very straightforward:

```bash
browserify --debug --entry ./scripts/load-bundle.js | exorcist dist/bundle.map > dist/bundle.js
```

We use the Browserify CLI to build our bundle (again, with load-bundle as the entry point; we then use a tool calledexorcist to strip out the sourcemap to an external file, leaving just the built bundle.js for deployment.
(We also perform a minification step using uglify, which isn't present here.)

### Running tests

Running tests looks a bit more complex:

```sh
node scripts/get-browserify-test-args.js $ARGS |
 xargs browserify --debug --full-paths --plugin=proxyquireify/plugin |
 ghostface --timeout 5000 --html tests/scaffold.html |
 tap-set-exit
``` 

What we do here is:

* Get our list of test arguments; this is a string builder that makes our list of test entry points (basically, a glob of every test file); the $ARGS allows us to override this list with a glob of our own (say, for running a single test file)
* Take those arguments and pass them into the Browserify CLI, along with the proxyquire plugin that we use for mocking dependencies.
* Pass the bundle into ghostface, which executes the Javascript in a PhantomJS environment.
* Pipe that output to tap-set-exit, which watches [TAP][] output and ensures our exit code is correctly set in the event of a test failure

Our list of entry points for our tests is huge; it's literally every test file. Earlier when I mentioned that entry points are just run in order, that's exactly what's happening here: all of our test files are essentially concatenated together, and then run as one giant test suite.

The `get-browserify-test-args.js` may look like a bit of cheating, but it's just a simple script which globs files and builds strings for us, which could have been done inline but was noisy and unweildy. The full contents of that file:

```javascript
var sprintf = require('util').format

var glob = require('glob')

var ENTRIES = [
 './lib/polyfills.js',
 './js/jquery.js'
]

var tests

if (process.argv.length > 2) {
 tests = process.argv.slice(2)
} else {
 tests = glob.sync('tests/**/*.test.js')
 tests = tests.concat(glob.sync('lib/*/**/tests/*.js'))
}

ENTRIES.forEach(function (entry) {
 console.log(sprintf('--entry %s', entry))
 console.log(sprintf('--noparse=%s', entry))
})

tests.forEach(function (entry) {
 console.log(sprintf('--entry %s', entry))
})
```

We now have a test environment that is comprised of commands with no knowledge of one another, and swapping a dependency becomes easy.

You might have noticed PhantomJS mentioned above: didn't I say earlier we ran our tests on jsdom?

### Swapping dependences: jsdom -> PhantomJS

Previously we had been running our tests in jsdom, which is a pure Javascript implementation of the DOM and HTML standards, hosted in Node.js. jsdom is a fantastic piece of engineering but it is not a browser, and it is not a complete implementation of the DOM. As such, we had written tests that were dependent on this environment, and not the browser. However, our clients are definitely visiting our website with browsers. This seems like a problem?

It had long been on our list to have tests 100% passing in a browser, but we weren't there yet. Our CI servers also didn't have a framebuffer available, so running Firefox or Chrome in our test environment was out, for now. However, when PhantomJS released their 2.0.0 version, they finally got close enough to a "real" browser that we opted to make the switch.
During his downtime, one of my teammates performed the arduous task of getting 100% of our tests passing in Chrome and jsom. Meanwhile, I had written ghostface (finishing it up during one of our company hack-weeks), which was a drop-in replacement for [jsdom-eval][], using PhantomJS as the environment vs jsdom.

When it came time to make the switch, we turned this:

```bash
node scripts/get-browserify-test-args.js $ARGS |
 xargs browserify --debug --full-paths --plugin=proxyquireify/plugin |
 jsdom --html tests/scaffold.html |
 tap-set-exit
```

Into this:

```bash
node scripts/get-browserify-test-args.js $ARGS |
 xargs browserify --debug --full-paths --plugin=proxyquireify/plugin |
 ghostface --timeout 5000 --html tests/scaffold.html |
 tap-set-exit
```

And we were running our tests on PhantomJS. Using pipes as our common interface gives us the flexibility to drop in new tools at a whim. Say we open up the ability to run full browsers on our CI? Replace ghostface for smokestack and away we go!

### Lessons Learned

Software engineers know: it's easy to say that what we had before was terrible, that we made bad choices, that we could've saved ourselves work by doing it right the first time. None of that is true here. What we had wasrevolutionary for the time; a system that was born because there weren't any solutions to the problems that we need to solve. So: we wrote one!
But the world now is very different from a few years ago; there are now many tools available to solve our problems. For us, the lessons are easy:

* Make it easy to switch dependencies. Something new will may come along that solves your problem better. This doesn't mean chase shiny new things; but when that shiny new thing becomes proven and solves your problem better, make it easy to move.
* We've had pipes in the Unix command line forever; it's an easy selection as a common interface, and you don't have to maintain it.
* Write code that is isolated and cleans up after itself, even in the browser. While it may seem like running all of your tests in the same environment is a flaw, running in a shared environment is exactly what your browser code will be doing. Every single page, widget, etc. that we write today has the ability to tear down and leave the browser environment exactly as it started.
* Avoid global behaviors in your frontend code: not only are they difficult to test, but they're difficult to reason about—their interactions with other code you write may have surprising results!

[browserify]: http://browserify.org/
[jsdom]: https://www.npmjs.com/package/jsdom
[frock-blog]: https://www.urbanairship.com/blog/introducing-frock-easy-fake-services-for-a-microservices-environment
[budo]: https://www.npmjs.com/package/budo
[exorcist]: https://www.npmjs.com/package/exorcist
[ghostface]: https://www.npmjs.com/package/ghostface
[PhantomJS]: http://phantomjs.org/
[tap-set-exit]: https://www.npmjs.com/package/tap-set-exit
[hack-weeks]: https://www.urbanairship.com/blog/hack-week-at-urban-airship
[smokestack]: https://www.npmjs.com/package/smokestack
[tape]: https://www.npmjs.com/package/tape
[sinon]: https://www.npmjs.com/package/sinon
[proxyquireify]: https://www.npmjs.com/package/proxyquireify
[TAP]: https://testanything.org/
