export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(message = "Recurso no encontrado") {
  return new HttpError(404, message);
}
