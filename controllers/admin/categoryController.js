import Category from "../../models/categoryModel.js";

// Render All Categories 
export const getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const search = req.query.search ? req.query.search.trim() : "";

    const query = {
      isActive: true,
      categoryName: { $regex: search, $options: "i" },
    };

    const total = await Category.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const categories = await Category.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render("admin/category", {
      title: "Category Management",
      categories,
      currentPage: page,
      totalPages,
      search,
      admin: req.session.user,
    });
  } catch (error) {
    console.error(" Error fetching categories:", error);
    res.status(500).render("partials/errorPage", { errorMessage: "Failed to load categories." });
  }
};

// Render Add Category Page
export const getAddCategoryPage = (req, res) => {
  try {
    res.render("admin/addCategory", { title: "Add Category", admin: req.session.user });
  } catch (error) {
    console.error(" Error rendering add category page:", error);
    res.status(500).render("partials/errorPage", { errorMessage: "Failed to load page." });
  }
};

//  Add New Category
export const addCategory = async (req, res) => {
  try {
    const { categoryName, description, categoryOffer } = req.body;
    const thumbnail = req.thumbnailUrl;
    
    if (!categoryName || categoryName.trim().length === 0) {
      return res.render("admin/addCategory", {
        title: "Add Category",
        admin: req.session.user,
        errorField: "categoryName",
        errorMessage: "Category name is required.",
      });
    }

    if (!thumbnail) {
      return res.render("admin/addCategory", {
        title: "Add Category",
        admin: req.session.user,
        errorField: "thumbnail",
        errorMessage: "Thumbnail image is required.",
      });
    }

    if (description && description.length < 10) {
      return res.render("admin/addCategory", {
        title: "Add Category",
        admin: req.session.user,
        errorField: "description",
        errorMessage: "Description must be at least 10 characters long.",
      });
    }

    if (categoryOffer && (categoryOffer < 0 || categoryOffer > 100)) {
      return res.render("admin/addCategory", {
        title: "Add Category",
        admin: req.session.user,
        errorField: "categoryOffer",
        errorMessage: "Offer must be between 0% and 100%.",
      });
    }

    // CHECK DUPLICATE
    const existingCategory = await Category.findOne({
      categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
    });

    if (existingCategory) {
      return res.render("admin/addCategory", {
        title: "Add Category",
        admin: req.session.user,
        errorField: "categoryName",
        errorMessage: "Oops! This category already exists.",
      });
    }

    // CREATE NEW CATEGORY
    await Category.create({
      categoryName,
      description,
      categoryOffer,
      thumbnail,
    });

    console.log("Category added successfully");
    res.redirect("/admin/categories?success=true");
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(500).render("partials/errorPage", {
      errorMessage: "Failed to add category.",
    });
  }
};


//  Render Edit Category Page
export const getEditCategoryPage = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).render("partials/errorPage", { errorMessage: "Category not found." });
    }

    res.render("admin/editCategory", {
      title: "Edit Category",
      category,
      admin: req.session.user,
    });
  } catch (error) {
    console.error(" Error rendering edit page:", error);
    res.status(500).render("partials/errorPage", { errorMessage: "Failed to load edit page." });
  }
};

//  Update Category 
export const editCategory = async (req, res) => {
  try {
    const { categoryName, description, categoryOffer } = req.body;
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(404).render("partials/errorPage", { 
        errorMessage: "Category not found." 
      });
    }

    // VALIDATIONS
    if (!categoryName || categoryName.trim().length === 0) {
      return res.render("admin/editCategory", {
        title: "Edit Category",
        category,
        admin: req.session.user,
        errorField: "categoryName",
        errorMessage: "Category name cannot be empty.",
      });
    }

    if (description && description.length < 10) {
      return res.render("admin/editCategory", {
        title: "Edit Category",
        category,
        admin: req.session.user,
        errorField: "description",
        errorMessage: "Description must be at least 10 characters.",
      });
    }

    if (categoryOffer && (categoryOffer < 0 || categoryOffer > 100)) {
      return res.render("admin/editCategory", {
        title: "Edit Category",
        category,
        admin: req.session.user,
        errorField: "categoryOffer",
        errorMessage: "Offer percentage must be between 0 and 100.",
      });
    }

    // DUPLICATE CATEGORY CHECK
    const duplicate = await Category.findOne({
      categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
      _id: { $ne: categoryId },
    });

    if (duplicate) {
      return res.render("admin/editCategory", {
        title: "Edit Category",
        category,
        admin: req.session.user,
        errorField: "categoryName",
        errorMessage: "Oops! Category name already exists.",
      });
    }

    // UPDATE FIELDS
    category.categoryName = categoryName.trim();
    category.description = description;
    category.categoryOffer = categoryOffer;

    if (req.thumbnailUrl) {
      category.thumbnail = req.thumbnailUrl;
    }

    await category.save();

    res.redirect(`/admin/categories?success=true`);

  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).render("partials/errorPage", { 
      errorMessage: "Failed to update category." 
    });
  }
};


//  Soft Delete Category 
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findByIdAndUpdate(id, { isActive: false });
    if (!category) {
      return res.status(404).json({ success: false,errorMessage: "Category not found" });
    }

    console.log(" Category soft deleted");
    res.json({ success: true, message: "Category soft deleted" });
  } catch (error) {
    console.error(" Error deleting category:", error);
    res.status(500).json({ success: false,errorMessage: "Failed to delete category" });
  }
};

//  Toggle Listed/Unlisted 
export const toggleCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ success: false, errorMessage: "Category not found" });
    }

    category.isListed = !category.isListed;
    await category.save();

    console.log(` Category "${category.categoryName}" toggled to ${category.isListed ? "Listed" : "Unlisted"}`);
    res.json({ success: true, isListed: category.isListed });
  } catch (error) {
    console.error(" Error toggling category:", error);
    res.status(500).json({ success: false, errorMessage: "Server error" });
  }
};
