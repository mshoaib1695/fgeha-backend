import { Transform } from 'class-transformer';

/** Coerce string "true"/"false" or 0/1 to boolean for DTO validation. */
export function ToBoolean() {
  return Transform(({ value }) => {
    if (value === true || value === false) return value;
    if (value === 'true' || value === 1 || value === '1') return true;
    if (value === 'false' || value === 0 || value === '0') return false;
    return value;
  });
}
