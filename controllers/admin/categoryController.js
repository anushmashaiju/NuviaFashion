import Category from "../../models/categoryModel.js";

// 🟢 Render All Categories (Paginated + Search)
export const getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // current page
    const limit = 5; // categories per page
    const search = req.query.search ? req.query.search.trim() : "";

    const query = {
      isActive: true,
      categoryName: { $regex: search, $options: "i" },
    };

    const total = await Category.countDocuments(query);
    const totalPages = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const categories = await Category.find(query)
      .sort({ createdAt: -1 }) // latest first
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
    console.error("❌ Error fetching categories:", error);
    res.status(500).render("user/errorPage", { message: "Failed to load categories." });
  }
};

// 🟢 Render Add Category Page
export const renderAddCategoryPage = (req, res) => {
  try {
    res.render("admin/addCategory", { title: "Add Category", admin: req.session.user });
  } catch (error) {
    console.error("❌ Error rendering add category page:", error);
    res.status(500).render("user/errorPage", { message: "Failed to load page." });
  }
};

// 🟢 Add New Category
export const addCategory = async (req, res) => {
  try {
    const { categoryName, description, categoryOffer } = req.body;
    const thumbnail = req.thumbnailUrl; // from middleware

    if (!categoryName || !thumbnail) {
      return res.status(400).render("user/errorPage", { message: "Missing required fields." });
    }

    await Category.create({
      categoryName,
      description,
      categoryOffer,
      thumbnail,
    });

    console.log("✅ Category added successfully");
    res.redirect("/admin/categories");
  } catch (error) {
    console.error("❌ Error adding category:", error);
    res.status(500).render("user/errorPage", { message: "Failed to add category." });
  }
};

// 🟢 Render Edit Category Page
export const renderEditCategoryPage = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(404).render("user/errorPage", { message: "Category not found." });
    }

    res.render("admin/editCategory", {
      title: "Edit Category",
      category,
      admin: req.session.user,
    });
  } catch (error) {
    console.error("❌ Error rendering edit page:", error);
    res.status(500).render("user/errorPage", { message: "Failed to load edit page." });
  }
};

// 🟢 Update Category
export const editCategory = async (req, res) => {
  try {
    const { categoryName, description, categoryOffer } = req.body;
    const thumbnail = req.thumbnailUrl; // from middleware

    const updateData = { categoryName, description, categoryOffer };
    if (thumbnail) updateData.thumbnail = thumbnail;

    await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    console.log("✅ Category updated successfully");
    res.redirect("/admin/categories");
  } catch (error) {
    console.error("❌ Error updating category:", error);
    res.status(500).render("user/errorPage", { message: "Failed to update category." });
  }
};

// 🟢 Soft Delete Category
export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    await Category.findByIdAndUpdate(id, { isActive: false });
    console.log("🗑️ Category soft deleted");
    res.redirect("/admin/categories");
  } catch (error) {
    console.error("❌ Error deleting category:", error);
    res.status(500).render("user/errorPage", { message: "Failed to delete category." });
  }
};

// 🟢 Toggle Listed/Unlisted (AJAX)
// 🟢 Toggle Listed/Unlisted (AJAX)
export const toggleCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);

    if (!category) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    // ✅ Flip the boolean value
    category.isListed = !category.isListed;
    await category.save();

    console.log(`🔁 Category "${category.categoryName}" toggled to ${category.isListed ? "Listed" : "Unlisted"}`);
    res.json({ success: true, isListed: category.isListed });
  } catch (error) {
    console.error("❌ Error toggling category:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

