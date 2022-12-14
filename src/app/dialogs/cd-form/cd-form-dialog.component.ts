import {Component, Inject, OnInit} from '@angular/core';
import {FormControl, FormGroup, Validators} from "@angular/forms";
import {AuthService, MusicsService} from "../../services/api";
import {MatSnackBar} from "@angular/material/snack-bar";
import {AuthManager} from "../../services/auth/auth";
import {MAT_DIALOG_DATA, MatDialogRef} from "@angular/material/dialog";
import {CD} from "../../services/api/model/cd";
import {FormErrorsHandler} from "../../shared/form/form-error-handler";
import {catchError, map, Observable, of, startWith} from "rxjs";
import Ean from 'ean-generator';
import {MUSIC_GENRES} from "../../shared/constants/genres";

export interface CdFormDialogResult {
  cd: CD;
}

@Component({
  selector: 'cd-form-dialog',
  templateUrl: './cd-form-dialog.component.html',
  styleUrls: ['./cd-form-dialog.component.scss']
})
export class CdFormDialogComponent implements OnInit {
  id = 0;
  preloading = false;
  form!: FormGroup;
  formErrors!: FormErrorsHandler;
  loading = false;
  defaultGenres: string[] = MUSIC_GENRES;
  filteredGenres!: Observable<string[]>;
  publishAsText: string|null = null;
  disabled: boolean = true;

  NAME_MAX_LENGTH = 50;
  ARTIST_NAME_MAX_LENGTH = 50;
  RECORD_COMPANY_MAX_LENGTH = 50;
  GENRE_MAX_LENGTH = 25;
  EAN_CODE_MAX_LENGTH = 13;
  PRICE_MAX_LENGTH = 8;

  constructor(private readonly dialogRef: MatDialogRef<CdFormDialogComponent>,
              private readonly authService: AuthService,
              private readonly musicsService: MusicsService,
              private readonly auth: AuthManager,
              private readonly snackbar: MatSnackBar,
              @Inject(MAT_DIALOG_DATA) readonly data: any) {
    if (data && 'id' in data) {
      this.preloading = true;
      this.id = data.id;
    }
    if (this.auth.currentUser) {
      this.publishAsText = `Publish as ${this.auth.currentUser.username}`;
      this.disabled = false;
    }
  }

  private _filterGenre(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.defaultGenres.filter(genre => genre.toLowerCase().includes(filterValue));
  }

  ngOnInit(): void {
    this.form = new FormGroup({
      name: new FormControl('', [Validators.required]),
      artist: new FormControl('', [Validators.required]),
      genre: new FormControl('', [Validators.required]),
      record_company: new FormControl('', [Validators.required]),
      ean_code: new FormControl('', [Validators.required]),
      price: new FormControl('', [Validators.required]),
    });
    this.filteredGenres = this.form.controls['genre'].valueChanges.pipe(
      startWith(''),
      map(value => this._filterGenre(value || '')),
    );
    this.formErrors = new FormErrorsHandler(this.form);

    if (this.disabled) {
      for (let k in this.form.controls) {
        this.form.controls[k].disable();
      }
    }

    if (this.id > 0) {
      this.musicsService.musicsRead(this.id)
        .pipe(
          catchError((response) => {
            this.snackbar.open('CD was not found', 'Close', {
              duration: 2000
            });
            console.error(response);
            setTimeout(() => {
              this.dialogRef.close();
            }, 1000);
            return of();
          })
        )
          .subscribe((cd) => {
          this.preloading = false;
          this.form.controls['name'].patchValue(cd.name);
          this.form.controls['artist'].patchValue(cd.artist);
          this.form.controls['genre'].patchValue(cd.genre);
          this.form.controls['record_company'].patchValue(cd.record_company);
          this.form.controls['ean_code'].patchValue(cd.ean_code);
          this.form.controls['price'].patchValue(cd.price);
        });
    }
  }

  generateRandomEan() {
    let ean = new Ean(['030', '031', '039']);
    this.form.controls['ean_code'].patchValue(ean.create());
  }

  resetGenre() {
    this.form.controls['genre'].patchValue('');
  }

  submit() {
    this.form.markAllAsTouched();
    this.formErrors.resetAllErrors();
    this.loading = true;

    let data = {
      name: this.form.value.name,
      artist: this.form.value.artist,
      record_company: this.form.value.record_company,
      genre: this.form.value.genre,
      ean_code: this.form.value.ean_code,
      price: this.form.value.price,
      price_currency: 'EUR',
      published_by: this.auth.currentUser?.id
    };
    let obs;
    if (this.id > 0) {
      obs = this.musicsService.musicsUpdate(this.id, data);
    } else {
      obs = this.musicsService.musicsCreate(data);
    }
    obs
      .pipe(
        catchError((response) => {
          this.loading = false;
          this.formErrors.onHttpError(response);
          return of();
        })
      )
      .subscribe((response: CD) => {
        this.loading = false;
        if (this.id > 0) {
          this.snackbar.open(`CD updated successfully`, 'Close', {
            duration: 3000
          });
        } else {
          this.snackbar.open(`CD added to the library successfully`, 'Close', {
            duration: 3000
          });
        }
        this.dialogRef.close(<CdFormDialogResult>{
          cd: response
        });
    });
  }

  numberOnly(event: KeyboardEvent, allowDot: boolean): boolean {
    const charCode = (event.which) ? event.which : event.keyCode;
    if (allowDot && charCode == 46) {
      return true;
    }
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      return false;
    }
    return true;
  }
}
