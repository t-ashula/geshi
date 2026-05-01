export type HttpStatusCode =
  | 200
  | 201
  | 202
  | 400
  | 404
  | 409
  | 422
  | 500
  | 502;

export type JsonEndpointResult = {
  body: unknown;
  status: HttpStatusCode;
};

export type BinaryEndpointResult =
  | {
      body: null;
      headers?: HeadersInit;
      status: HttpStatusCode;
    }
  | {
      body: Uint8Array;
      headers: HeadersInit;
      status: HttpStatusCode;
    };
