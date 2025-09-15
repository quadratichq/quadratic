local session = std.extVar('session');

{
  claims: {
    email: session.identity.traits.email,
    sub: session.identity.id,
  }
}