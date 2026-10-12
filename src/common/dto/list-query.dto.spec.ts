import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListQueryDto } from './list-query.dto.js';

describe('ListQueryDto', () => {
  it('rejects invalid page and page-size boundaries', async () => {
    const query = plainToInstance(ListQueryDto, {
      page: '0',
      pageSize: '101',
    });

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['page', 'pageSize']),
    );
  });

  it('rejects invalid sort direction and malformed typed filters', async () => {
    const query = plainToInstance(ListQueryDto, {
      sortOrder: 'sideways',
      email: 'not-an-email',
      isActive: 'sometimes',
    });

    const errors = await validate(query);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['sortOrder', 'email', 'isActive']),
    );
  });
});
