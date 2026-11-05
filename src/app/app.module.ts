import { inject, NgModule, provideAppInitializer } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";
import { AppRoutingModule } from "./app-routing.module";
import { FooterComponent } from "./core/layout/footer.component";
import { HeaderComponent } from "./core/layout/header.component";
import { JwtService } from "./core/services/jwt.service";
import { UserService } from "./core/services/user.service";
import { EMPTY } from "rxjs";
import {
  HTTP_INTERCEPTORS,
  provideHttpClient,
  withInterceptorsFromDi,
  withXhr,
} from "@angular/common/http";
import { TokenInterceptor } from "./core/interceptors/token.interceptor";
import { ErrorInterceptor } from "./core/interceptors/error.interceptor";
import { ApiInterceptor } from "./core/interceptors/api.interceptor";

export function initAuth(jwtService: JwtService, userService: UserService) {
  return () => (jwtService.getToken() ? userService.getCurrentUser() : EMPTY);
}

@NgModule({
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  imports: [BrowserModule, FooterComponent, HeaderComponent, AppRoutingModule],
  providers: [
    provideAppInitializer(() =>
      initAuth(inject(JwtService), inject(UserService))()
    ),
    { provide: HTTP_INTERCEPTORS, useClass: ApiInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
    { provide: HTTP_INTERCEPTORS, useClass: ErrorInterceptor, multi: true },
    provideHttpClient(withXhr(), withInterceptorsFromDi()),
  ],
})
export class AppModule {}
