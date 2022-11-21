#[macro_use]
extern crate rocket;
use rocket::serde::{json::Json, Serialize};

#[derive(Serialize)]
#[serde(crate = "rocket::serde")]
struct QuadraticAccount {
    name: String,
    files: Vec<String>,
}

#[get("/")]
fn hello() -> Json<QuadraticAccount> {
    let q_account = QuadraticAccount {
        name: "Jon Snow".to_string(),
        files: Vec::from([{ "file1".to_string() }, "file2".to_string()]),
    };
    Json(q_account)
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![hello])
}
