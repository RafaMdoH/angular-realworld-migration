import { TestBed } from "@angular/core/testing";
import {
  HTTP_INTERCEPTORS,
  HttpClient,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ErrorInterceptor } from "./error.interceptor";

describe("ErrorInterceptor (characterization)", () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("passes successful responses through unchanged", () => {
    let body: unknown;
    http.get("/ok").subscribe((b) => (body = b));

    controller.expectOne("/ok").flush({ a: 1 });

    expect(body).toEqual({ a: 1 });
  });

  it("rethrows only the error body (err.error) instead of the HttpErrorResponse", () => {
    let error: unknown;
    http.get("/bad").subscribe({ error: (e) => (error = e) });

    controller
      .expectOne("/bad")
      .flush(
        { errors: { email: ["is invalid"] } },
        { status: 422, statusText: "Unprocessable Entity" }
      );

    expect(error).toEqual({ errors: { email: ["is invalid"] } });
  });

  it("rethrows null for an error response without a body", () => {
    let error: unknown = "unset";
    http.get("/empty").subscribe({ error: (e) => (error = e) });

    controller
      .expectOne("/empty")
      .flush(null, { status: 500, statusText: "X" });

    expect(error).toBeNull();
  });
});
