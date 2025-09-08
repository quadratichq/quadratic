use http::HeaderMap;
use quadratic_rust_shared::{
    auth::jwt::authorize_m2m,
    quadratic_api::{Connection as ApiConnection, Team, get_connection, get_team},
    sql::UsesSsh,
};
use serde::de::DeserializeOwned;
use uuid::Uuid;

use crate::{auth::Claims, error::Result, header::get_team_id_header, state::State};

pub(crate) async fn get_api_connection<T: DeserializeOwned>(
    state: &State,
    jwt: &str,
    user_id: &str,
    connection_id: &Uuid,
    team_id: &Uuid,
    headers: &HeaderMap,
) -> Result<ApiConnection<T>> {
    let base_url = state.settings.quadratic_api_uri.to_owned();
    let m2m_token = state.settings.m2m_auth_token.clone();
    let (is_internal, token) = match authorize_m2m(&headers, &m2m_token) {
        Ok(_token) => (true, m2m_token),
        Err(_) => (false, jwt.to_string()),
    };
    let connection = get_connection(
        &base_url,
        &token,
        user_id,
        connection_id,
        team_id,
        is_internal,
    )
    .await?;

    Ok(connection)
}

/// Get the team from the quadratic API server.
pub(crate) async fn get_api_team(
    state: &State,
    jwt: &str,
    user_id: &str,
    team_id: &Uuid,
) -> Result<Team> {
    let base_url = state.settings.quadratic_api_uri.to_owned();
    let team = get_team(&base_url, jwt, user_id, team_id).await?;

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
        let team = get_api_team(state, "", &claims.sub, &team_id).await?;
        connection.set_ssh_key(Some(team.ssh_private_key));
    }

    Ok(())
}
