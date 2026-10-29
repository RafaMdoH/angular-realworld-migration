import { TestBed } from "@angular/core/testing";
import { HTTP_INTERCEPTORS, HttpClient } from "@angular/common/http";
import {
  HttpClientTestingModule,
  HttpTestingController,
} from "@angular/common/http/testing";
import { JwtService } from "../services/jwt.service";
import { TokenInterceptor } from "./token.interceptor";

describe("TokenInterceptor (characterization)", () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let jwt: JwtService;

  beforeEach(() => {
    window.localStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    jwt = TestBed.inject(JwtService);
  });

  afterEach(() => {
    controller.verify();
    window.localStorage.clear();
  });

  it("adds an Authorization header with the Token scheme when a token exists", () => {
    jwt.saveToken("secret");

    http.get("/user").subscribe();

    const req = controller.expectOne("/user");
    expect(req.request.headers.get("Authorization")).toBe("Token secret");
    req.flush({});
  });

  it("does not add an Authorization header when there is no token", () => {
    http.get("/articles").subscribe();

    const req = controller.expectOne("/articles");
    expect(req.request.headers.has("Authorization")).toBeFalse();
    req.flush({});
  });

  it("reads the token on every request", () => {
    http.get("/a").subscribe();
    controller.expectOne("/a").flush({});

    jwt.saveToken("later");
    http.get("/b").subscribe();

    const req = controller.expectOne("/b");
    expect(req.request.headers.get("Authorization")).toBe("Token later");
    req.flush({});
  });
});
