import { Controller, Get, Param } from "@nestjs/common";
import { UserService } from "./user.service";

@Controller("profile")
export class ProfileController {
  constructor(private userService: UserService) {}

  /** 公开的个人主页数据 */
  @Get(":username")
  getPublicProfile(@Param("username") username: string) {
    return this.userService.getPublicProfile(username);
  }

  /** 公开的统计数据 (图表) */
  @Get(":username/stats")
  getProfileStats(@Param("username") username: string) {
    return this.userService.getProfileStats(username);
  }
}
