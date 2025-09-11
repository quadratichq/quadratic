use http::HeaderMap;
use quadratic_rust_shared::{
    quadratic_api::{Connection as ApiConnection, Team, get_connection, get_team},
    sql::UsesSsh,
};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use crate::{auth::Claims, error::Result, header::get_team_id_header, state::State};

pub(crate) async fn get_api_connection<T: DeserializeOwned>(
    state: &State,
    jwt: &str,
    email: &str,
    connection_id: &Uuid,
    team_id: &Uuid,
) -> Result<ApiConnection<T>> {
    let base_url = state.settings.quadratic_api_uri.to_owned();
    let connection = get_connection(&base_url, jwt, email, connection_id, team_id).await?;

    Ok(connection)
}

/// Get the team from the quadratic API server.
pub(crate) async fn get_api_team(
    state: &State,
    jwt: &str,
    email: &str,
    team_id: &Uuid,
) -> Result<Team> {
    let base_url = state.settings.quadratic_api_uri.to_owned();
    let team = get_team(&base_url, jwt, email, team_id).await?;

    Ok(team)
}

pub(crate) async fn add_key_to_connection<T: DeserializeOwned + UsesSsh>(
    connection: &mut T,
    state: &State,
    headers: &HeaderMap,
    claims: &Claims,
) -> Result<()> {
    if connection.use_ssh() {
        let team_id = get_team_id_header(headers)?;
        let team = get_api_team(state, "", &claims.email, &team_id).await?;
        connection.set_ssh_key(Some(team.ssh_private_key));
    }

    Ok(())
}
