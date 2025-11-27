mod client;
mod api;
mod core;
mod multiplayer;
mod files;
mod connection;
mod python;
mod types;
mod shared;
mod service;

use crate::types::ServiceConfig;
use service::Service;

pub fn get_services() -> Vec<ServiceConfig> {
    vec![
        client::ClientService.config(),
        api::ApiService.config(),
        core::CoreService.config(),
        multiplayer::MultiplayerService.config(),
        files::FilesService.config(),
        connection::ConnectionService.config(),
        types::TypesService.config(),
        python::PythonService.config(),
        shared::SharedService.config(),
    ]
}

pub fn get_service_by_name(name: &str) -> Option<Box<dyn Service + Send + Sync>> {
    match name {
        "client" => Some(Box::new(client::ClientService)),
        "api" => Some(Box::new(api::ApiService)),
        "core" => Some(Box::new(core::CoreService)),
        "multiplayer" => Some(Box::new(multiplayer::MultiplayerService)),
        "files" => Some(Box::new(files::FilesService)),
        "connection" => Some(Box::new(connection::ConnectionService)),
        "types" => Some(Box::new(types::TypesService)),
        "python" => Some(Box::new(python::PythonService)),
        "shared" => Some(Box::new(shared::SharedService)),
        _ => None,
    }
}
