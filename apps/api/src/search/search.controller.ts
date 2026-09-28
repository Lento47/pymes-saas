import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { SEARCHABLE_TYPES, SearchService } from "./search.service";

/** Every type, so omitting `?types=` searches the whole workspace. */
const DEFAULT_TYPES = SEARCHABLE_TYPES.join(",");

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  search(
    @CurrentUser("workspace_id") workspaceId: string,
    @Query("q") q: string,
    @Query("types") types: string = DEFAULT_TYPES,
    @Query("limit") limit: number = 10,
  ) {
    const typeList = types
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return this.searchService.search(workspaceId, q ?? "", typeList, Number(limit));
  }
}
