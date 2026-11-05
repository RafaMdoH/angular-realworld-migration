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
import { ApiInterceptor } from "./api.interceptor";

describe("ApiInterceptor (characterization)", () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: ApiInterceptor, multi: true },
        provideHttpClient(withXhr(), withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it("prefixes relative urls with the RealWorld API base url", () => {
    http.get("/articles").subscribe();

    const req = controller.expectOne("https://api.realworld.io/api/articles");
    expect(req.request.method).toBe("GET");
    req.flush({});
  });

  it("prefixes absolute urls too (no check for an existing host)", () => {
    http.get("https://example.com/x").subscribe();

    const req = controller.expectOne(
      "https://api.realworld.io/apihttps://example.com/x"
    );
    expect(req.request.method).toBe("GET");
    req.flush({});
  });

  it("keeps method and body untouched", () => {
    http.post("/users", { a: 1 }).subscribe();

    const req = controller.expectOne("https://api.realworld.io/api/users");
    expect(req.request.method).toBe("POST");
    expect(req.request.body).toEqual({ a: 1 });
    req.flush({});
  });
});
