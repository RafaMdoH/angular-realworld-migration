import { TestBed } from "@angular/core/testing";
import { HTTP_INTERCEPTORS, HttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { AppModule } from "./app.module";
import { ApiInterceptor } from "./core/interceptors/api.interceptor";
import { ErrorInterceptor } from "./core/interceptors/error.interceptor";
import { TokenInterceptor } from "./core/interceptors/token.interceptor";

describe("AppModule HTTP interceptor chain (integration)", () => {
  const API = "https://api.realworld.io/api";
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    controller.verify();
    window.localStorage.clear();
  });

  it("registers the interceptors in the order Api, Token, Error", () => {
    const interceptors = TestBed.inject(HTTP_INTERCEPTORS);

    expect(interceptors.map((i) => i.constructor)).toEqual([
      ApiInterceptor,
      TokenInterceptor,
      ErrorInterceptor,
    ]);
  });

  it("prefixes the API base URL and adds the Token header on one request", () => {
    window.localStorage["jwtToken"] = "abc";

    http.get("/user").subscribe();

    const req = controller.expectOne(`${API}/user`);
    expect(req.request.headers.get("Authorization")).toBe("Token abc");
    req.flush({});
  });

  it("sends no Authorization header when there is no token", () => {
    http.get("/tags").subscribe();

    const req = controller.expectOne(`${API}/tags`);
    expect(req.request.headers.has("Authorization")).toBeFalse();
    req.flush({});
  });

  it("rethrows the error body instead of the HttpErrorResponse", () => {
    const body = { errors: { email: ["is invalid"] } };
    let received: unknown;

    http.post("/users", {}).subscribe({ error: (e) => (received = e) });
    controller
      .expectOne(`${API}/users`)
      .flush(body, { status: 422, statusText: "Unprocessable Entity" });

    expect(received).toEqual(body);
  });
});
