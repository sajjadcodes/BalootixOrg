import { validateSync } from 'class-validator';
import { UpdateUserDto } from './update-user.dto.js';

describe('UpdateUserDto', () => {
  it.each([
    '+1234567',
    '+12345678',
    '+123456789',
    '+1234567890',
    '+12345678901',
    '+123456789012',
    '+1234567890123',
    '+12345678901234',
    '+123456789012345',
    '+61412345678',
  ])('accepts valid mobile number %s', (mobile) => {
    const dto = Object.assign(new UpdateUserDto(), { mobile });

    expect(validateSync(dto)).toEqual([]);
  });

  it.each([
    '1234567890',
    '+123456',
    '+1234567890123456',
    '+12abc456789',
    '+123 4567890',
    '+1234567890 ext 12',
  ])('rejects invalid mobile number %s', (mobile) => {
    const dto = Object.assign(new UpdateUserDto(), { mobile });

    expect(validateSync(dto)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          property: 'mobile',
          constraints: expect.objectContaining({ matches: expect.any(String) }),
        }),
      ]),
    );
  });

  it('allows mobile to be omitted or cleared', () => {
    expect(validateSync(new UpdateUserDto())).toEqual([]);
    expect(
      validateSync(Object.assign(new UpdateUserDto(), { mobile: null })),
    ).toEqual([]);
  });
});
