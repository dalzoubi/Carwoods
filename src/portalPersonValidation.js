import { looksLikeEmail, looksLikePhone } from './contactValidation';

function requiredTextError(value, t, requiredKey) {
  return String(value ?? '').trim() ? '' : t(requiredKey);
}

function emailFieldError(value, t, keys) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return t(keys.required);
  return looksLikeEmail(normalized) ? '' : t(keys.invalid);
}

function phoneFieldError(value, t, keys, options) {
  const normalized = String(value ?? '').trim();
  if (!normalized) {
    return options?.requirePhone ? t(keys.required) : '';
  }
  return looksLikePhone(normalized) ? '' : t(keys.invalid);
}

export function validatePersonBasics(form, t, options) {
  const firstName = String(form?.firstName ?? '');
  const lastName = String(form?.lastName ?? '');
  const email = String(form?.email ?? '');
  const phone = String(form?.phone ?? '');
  const keys = options?.keys;
  const requirePhone = Boolean(options?.requirePhone);

  const errors = {};
  const firstNameError = requiredTextError(firstName, t, keys.firstNameRequired);
  if (firstNameError) errors.firstName = firstNameError;
  const lastNameError = requiredTextError(lastName, t, keys.lastNameRequired);
  if (lastNameError) errors.lastName = lastNameError;
  const emailError = emailFieldError(email, t, { required: keys.emailRequired, invalid: keys.emailInvalid });
  if (emailError) errors.email = emailError;

  if (keys.phoneInvalid) {
    const phoneError = phoneFieldError(
      phone,
      t,
      { required: keys.phoneRequired, invalid: keys.phoneInvalid },
      { requirePhone }
    );
    if (phoneError) errors.phone = phoneError;
  }

  return errors;
}

export function validatePersonField(field, value, t, options) {
  if (field === 'firstName') {
    return requiredTextError(value, t, options.keys.firstNameRequired);
  }
  if (field === 'lastName') {
    return requiredTextError(value, t, options.keys.lastNameRequired);
  }
  if (field === 'email') {
    return emailFieldError(value, t, {
      required: options.keys.emailRequired,
      invalid: options.keys.emailInvalid,
    });
  }
  if (field === 'phone' && options.keys.phoneInvalid) {
    return phoneFieldError(
      value,
      t,
      { required: options.keys.phoneRequired, invalid: options.keys.phoneInvalid },
      { requirePhone: Boolean(options.requirePhone) }
    );
  }
  return '';
}
