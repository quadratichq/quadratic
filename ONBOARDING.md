# Onboarding

Ramping up on this codebase requries knowledge of TypeScript, WebGL, WASM, Rust, networking, and general spreadsheet paradigms.

## Rust

Learning Rust is best done in the following order:

1. Read a relevant section of the [Rust Book](https://doc.rust-lang.org/book/) and work on the corresponding [Rustlings](https://github.com/rust-lang/rustlings) exercise.

    | Exercise        | Book Chapter |
    | --------------- | ------------ |
    | variables       | §3.1         |
    | functions       | §3.3         |
    | if              | §3.5         |
    | primitive_types | §3.2, §4.3   |
    | vecs            | §8.1         |
    | move_semantics  | §4.1-2       |
    | structs         | §5.1, §5.3   |
    | enums           | §6, §18.3    |
    | strings         | §8.2         |
    | modules         | §7           |
    | hashmaps        | §8.3         |
    | options         | §10.1        |
    | error_handling  | §9           |
    | generics        | §10          |
    | traits          | §10.2        |
    | tests           | §11.1        |
    | lifetimes       | §10.3        |
    | iterators       | §13.2-4      |
    | threads         | §16.1-3      |
    | smart_pointers  | §15, §16.3   |
    | macros          | §19.6        |
    | clippy          | §21.4        |
    | conversions     | n/a          |

2. Pick an onboarding project to work on.  
   * For each project, come up with a reasonable solution and post it on GitHub (public or private repo).  Don't worry about being perfect and much of the learning will take place in the PR process.  
   * Note to PR reviewers:  the review process should be iterative, building upon next-steps for each comment round to increase knowledge by one level.  For example, encourage idiomatic Rust by making sure failable functions return results (and options for nullable).  Enforce Clippy standards.  Then gradually layer in more complex patterns (e.g. thiserror/anyhow, reducing heap allocations, async, ...etc.).
      * The first project should focus on Rust that doensn't use many 3rd party crates (mostly standard library).
      * The second project should be more complex, using 3rd party crates.
   
## Onboarding Exercises

### Rust

The point of these exercises is to learn idiomatic Rust, so it's best to focus on creating your own solutions rather than using the work of other GitHub repos or AI.  It's suggested that you turn Copilot (or equiv) off for these exercises for maximum learning.

#### HTTP Server

Without using existing HTTP server crates, create a minimal HTTP/1.1 server using TCP sockets (do not support HTTPS).

* Store internal state in a HashMap.
* It should support GET, POST, and DELETE verbs for any incoming URI.
  * For POST verbs, each URI should map to the body and MIME type and should create or update accordingly.  Respond with a status code of 200 OK.
  * For GET verbs, respond with the mapping for the URI with a status code of 200 OK.
  * For DELETE verbs, remove the mapping from the HashMap.
  * GET or DELETE requests that don't match to a key in the HashMap should return a status code of 404 Not Found.
* Capture HTTP Headers Content-Type and Content-Length.
  * Allow other headers, but skip past them when parsing.
  * Accept any content type (no validation required)
* Add tests

##### POST

```shell
curl -i -H "Content-Type: text/plain" -X POST -d 'bar' 
```

POST Request:

```shell
POST /foo HTTP/1.1
User-Agent: Chrome/116.0.0.0
Host: quadratichq.com
Accept: */*
Content-Length: 3
Content-Type: text/plain

bar
```

POST Response:

```shell
HTTP/1.1 200 OK

```

##### GET

```shell
curl -i http://localhost:8000/foo
```

GET Request:

```shell
GET /foo HTTP/1.1
User-Agent: Chrome/116.0.0.0
Host: quadratichq.com
Accept: */*

```

GET Response:

```shell
HTTP/1.1 200 OK
Content-Length: 3
Content-Type: text/plain

bar

```

##### DELETE

```shell
curl -i -X DELETE http://localhost:8000/foo
```

DELETE Response:

```shell
DELETE /foo HTTP/1.1
User-Agent: Chrome/116.0.0.0
Host: quadratichq.com
Accept: */*

```

DELETE Response:

```shell
HTTP/1.1 200 OK

```