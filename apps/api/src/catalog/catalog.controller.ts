import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { CatalogService } from "./catalog.service";
import { ListProductsQueryDto } from "./dto/list-products.dto";

@ApiTags("catalog")
@Controller({ path: "", version: "1" })
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("categories")
  listCategories() {
    return this.catalog.listCategories();
  }

  @Get("categories/:slug")
  getCategory(@Param("slug") slug: string) {
    return this.catalog.getCategoryBySlug(slug);
  }

  @Get("producers")
  listProducers() {
    return this.catalog.listProducers();
  }

  @Get("packaging-options")
  listPackagingOptions() {
    return this.catalog.listPackagingOptions();
  }

  @Get("products")
  listProducts(@Query() query: ListProductsQueryDto) {
    return this.catalog.listProducts(query);
  }

  @Get("products/:slug")
  getProduct(@Param("slug") slug: string) {
    return this.catalog.getProductBySlug(slug);
  }
}
