-- Additive setup for databases that have not yet received the category tables.
-- Existing problem lists, problems and submissions are not modified.
CREATE TABLE `problem_list_categories` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(60) NOT NULL,
  `description` VARCHAR(300) NULL,
  `parent_id` INTEGER NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  INDEX `problem_list_categories_parent_id_sort_order_idx` (`parent_id`, `sort_order`),
  PRIMARY KEY (`id`),
  CONSTRAINT `problem_list_categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `problem_list_categories` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `problem_list_category_items` (
  `category_id` INTEGER NOT NULL,
  `list_id` INTEGER NOT NULL,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  INDEX `problem_list_category_items_category_id_sort_order_list_id_idx` (`category_id`, `sort_order`, `list_id`),
  INDEX `problem_list_category_items_list_id_idx` (`list_id`),
  PRIMARY KEY (`category_id`, `list_id`),
  CONSTRAINT `problem_list_category_items_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `problem_list_categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `problem_list_category_items_list_id_fkey` FOREIGN KEY (`list_id`) REFERENCES `problem_lists` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
