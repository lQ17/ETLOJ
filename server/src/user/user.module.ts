import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { ProfileController } from './profile.controller';
import { AvatarController } from './avatar.controller';
import { AvatarService } from './avatar.service';

@Module({
  controllers: [UserController, ProfileController, AvatarController],
  providers: [UserService, AvatarService],
  exports: [UserService],
})
export class UserModule {}
