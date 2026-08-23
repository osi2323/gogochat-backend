import { validate } from 'class-validator';
import { UpdateUserGifDto } from './update-user-gif.dto';

describe('UpdateUserGifDto', () => {
  it('accepts string value', async () => {
    const dto = new UpdateUserGifDto();
    dto.userGif = '/usergifler/kelebek.gif';

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('accepts null value', async () => {
    const dto = new UpdateUserGifDto();
    dto.userGif = null;

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });
});
