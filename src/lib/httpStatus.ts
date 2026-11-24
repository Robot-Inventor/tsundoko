const httpStatus = {
    badGateway: 502,
    badRequest: 400,
    conflict: 409,
    created: 201,
    forbidden: 403,
    found: 302,
    internalServerError: 500,
    movedPermanently: 301,
    noContent: 204,
    notFound: 404,
    ok: 200,
    payloadTooLarge: 413,
    permanentRedirect: 308,
    seeOther: 303,
    temporaryRedirect: 307,
    unauthorized: 401,
    unsupportedMediaType: 415
} as const;

export { httpStatus };
