import { Component, Input, ChangeDetectionStrategy } from "@angular/core";
import { Errors } from "../core/models/errors.model";

@Component({
  selector: "app-list-errors",
  templateUrl: "./list-errors.component.html",
  changeDetection: ChangeDetectionStrategy.Eager,
  imports: [],
})
export class ListErrorsComponent {
  errorList: string[] = [];

  @Input() set errors(errorList: Errors | null) {
    this.errorList = errorList
      ? Object.keys(errorList.errors || {}).map(
          (key) => `${key} ${errorList.errors[key]}`
        )
      : [];
  }
}
