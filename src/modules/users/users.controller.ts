import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { UsersService } from './users.service.js';
import type { UserData } from './types/user.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RequirePermission } from '../authorization/decorators/require-permission.decorator.js';
import { AuthorizationGuard } from '../authorization/guards/authorization.guard.js';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission('/users', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  listUsers(): Promise<UserData[]> {
    return this.usersService.listUsers();
  }

  @Get(':id')
  @RequirePermission('/users/:id', 'READ')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  getUser(@Param('id') id: string): Promise<UserData> {
    return this.usersService.getUser(id);
  }

  @Patch(':id')
  @RequirePermission('/users/:id', 'UPDATE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  updateUser(
    @Param('id') id: string,
    @Body() input: UpdateUserDto,
  ): Promise<UserData> {
    return this.usersService.updateUser(id, input);
  }

  @Delete(':id')
  @RequirePermission('/users/:id', 'DELETE')
  @UseGuards(JwtAuthGuard, AuthorizationGuard)
  @HttpCode(HttpStatus.OK)
  deleteUser(@Param('id') id: string) {
    return this.usersService.deleteUser(id);
  }
}
