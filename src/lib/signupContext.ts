// The passkey plugin only forwards its `context` option as a GET query parameter, so the query carries
// this marker alone. The signed token travels in an HttpOnly cookie and is read by the plugin hooks.
const signupContextMarker = "cookie";

export { signupContextMarker };
