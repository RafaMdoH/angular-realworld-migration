import { Component, inject, ChangeDetectionStrategy } from "@angular/core";
import { UserService } from "../services/user.service";
import { RouterLink, RouterLinkActive } from "@angular/router";
import { AsyncPipe } from "@angular/common";
import { ShowAuthedDirective } from "../../shared/show-authed.directive";

@Component({
  selector: "app-layout-header",
  templateUrl: "./header.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [RouterLinkActive, RouterLink, AsyncPipe, ShowAuthedDirective],
})
export class HeaderComponent {
  currentUser$ = inject(UserService).currentUser;
}
