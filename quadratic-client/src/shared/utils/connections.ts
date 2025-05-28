import type { ApiTypes } from 'quadratic-shared/typesAndSchemas';

/**
 * The server returns all connections the user has access to, including the
 * hidden demo connection. It's useful to have this connection, even when it's
 * not visible to the user. For example: a team may have the demo connection
 * hidden but a file may have the demo connection in it (in which case they'll
 * be able to see the connection name in the code editor).
 *
 * This function is for the places in the UI where we don't want to show a
 * connection that's hidden.
 */
export const getVisibleConnections = (connections: ApiTypes['/v0/teams/:uuid/connections.GET.response']) => {
  return connections.filter((c) => (c.hasOwnProperty('isDemo') ? c.isDemoVisible : true));
};
