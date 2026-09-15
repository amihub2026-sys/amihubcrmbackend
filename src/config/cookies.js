export function sessionCookies(config) {
  return {
    cookie: {
      httpOnly: true,
      secure: config.production,
      sameSite: "lax",
      path: "/",
      maxAge: config.sessionHours * 3600000,
    },
    cookieName: config.production ? "__Host-crm_session" : "crm_session",
  };
}
