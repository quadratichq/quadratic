//! Request
//!
//! Functions to interact with requests

#[cfg(feature = "httpmock")]
use httpmock::{MockServer, Recording};
use std::path::PathBuf;

include!(concat!(env!("CARGO_MANIFEST_DIR"), "/src/auto_gen_path.rs"));

/// Get the path to a scenario
pub fn scenario_path(scenario: &str) -> PathBuf {
    let scenario_path = format!("{FIXTURES_PATH}/{scenario}.yml");
    PathBuf::from(scenario_path)
}

#[cfg(feature = "httpmock")]
/// Get a server
pub fn get_server(record: bool, scenario: &str, url: &str) -> MockServer {
    match record {
        true => recording_server(url),
        false => playback_server(scenario),
    }
}

#[cfg(feature = "httpmock")]
/// Get a recording server
pub fn recording_server(url: &str) -> MockServer {
    let recording_server = MockServer::start();

    // proxy all requests from the mock server to `url`
    recording_server.forward_to(url, |rule| {
        rule.filter(|when| {
            when.any_request();
        });
    });

    recording_server
}

#[cfg(feature = "httpmock")]
/// Get a playback server
pub fn playback_server(scenario: &str) -> MockServer {
    let path = scenario_path(scenario);
    let playback_server = MockServer::start();
    playback_server.playback(path);

    playback_server
}

#[cfg(feature = "httpmock")]
/// Start recording
pub fn record_start(recording_server: &MockServer) -> Recording<'_> {
    recording_server.record(|rule| {
        rule.filter(|when| {
            when.any_request();
        });
    })
}

#[cfg(feature = "httpmock")]
/// Stop recording
pub async fn record_stop(scenario: &str, recording: Recording<'_>) {
    let path = scenario_path(scenario);
    let fixtures_path = PathBuf::from(FIXTURES_PATH);
    let saved_path = recording
        .save_to_async(fixtures_path, scenario)
        .await
        .expect("cannot store scenario on disk");

    std::fs::rename(saved_path, path).unwrap();
}
