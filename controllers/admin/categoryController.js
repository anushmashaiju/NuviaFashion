import Category from "../../models/categoryModel.js";
import MESSAGES from "../../utils/messages.js";
import STATUS from "../../utils/statusCodes.js";

// Render All Categories 
const getCategories = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const search = req.query.search?.trim() || "";

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
      .limit(limit)
      .lean();

    const now = new Date();

    const enrichedCategories = categories.map(cat => {
      let offerActive = false;

      if (
        cat.categoryOffer?.percentage > 0 &&
        cat.categoryOffer.startDate &&
        cat.categoryOffer.endDate &&
        now >= new Date(cat.categoryOffer.startDate) &&
        now <= new Date(cat.categoryOffer.endDate)
      ) {
        offerActive = true;
      }

      return {
        ...cat,
        offerActive
      };
    });

    res.render("admin/category", {
      title: "Category Management",
      categories: enrichedCategories,
      currentPage: page,
      totalPages,
      search,
      admin: req.session.user,
    });
  } catch (error) {
    console.error(error);
    res.status(STATUS.SERVER_ERROR).send("Server Error");
  }
};


// Render Add Category Page
const getAddCategoryPage = (req, res) => {
  try {
    res.status(STATUS.SUCCESS).render("admin/addCategory", {
      title: "Add Category",
      admin: req.session.user,
      formData: {
        categoryOffer: "",
        categoryOfferStart: "",
        categoryOfferEnd: ""
      },
      errors: {}
    });

  } catch (error) {
    console.error("Error rendering add category page:", error);
    res.status(STATUS.SERVER_ERROR).render("partials/errorPage", { errorMessage: MESSAGES.SERVER_ERROR });
  }
};

// Add New Category
const addCategory = async (req, res) => {
  try {
    const { categoryName, description, categoryOffer, categoryOfferStart, categoryOfferEnd } = req.body;
    const thumbnail = req.thumbnailUrl;

    const formData = { categoryName, description, categoryOffer, categoryOfferStart, categoryOfferEnd };
    const errors = {};

    if (!categoryName || categoryName.trim().length === 0) {
      errors.categoryName = MESSAGES.CATEGORY_NAME_REQUIRED;
    }
    if (!thumbnail) {
      errors.thumbnail = MESSAGES.CATEGORY_THUMBNAIL_REQUIRED;
    }
    if (!description || description.trim().length < 10) {
      errors.description = MESSAGES.CATEGORY_DESCRIPTION_SHORT;
    }

    let offerObj = null;
    if (categoryOffer) {
      const offerPercent = Number(categoryOffer);
      if (isNaN(offerPercent) || offerPercent < 0 || offerPercent > 100) {
        errors.categoryOffer = MESSAGES.CATEGORY_OFFER_INVALID;
      } else {
        const startDate = categoryOfferStart ? new Date(categoryOfferStart) : null;
        const endDate = categoryOfferEnd ? new Date(categoryOfferEnd) : null;
        const now = new Date();
        const isActive = (!startDate || startDate <= now) && (!endDate || endDate >= now);

        offerObj = {
          percentage: offerPercent,
          startDate,
          endDate,
          isActive,
        };
      }
    }

    const existingCategory = await Category.findOne({
      categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
    });
    if (existingCategory) {
      errors.categoryName = MESSAGES.CATEGORY_EXISTS;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(STATUS.BAD_REQUEST).render("admin/addCategory", {
        title: "Add Category",
        admin: req.session.user,
        formData,
        errors,
      });
    }

    await Category.create({
      categoryName,
      description,
      categoryOffer: offerObj,
      thumbnail,
    });

    res.redirect(`/admin/categories/add?success=true`);
  } catch (error) {
    console.error("Error adding category:", error);
    res.status(STATUS.SERVER_ERROR).render("partials/errorPage", { errorMessage: MESSAGES.SERVER_ERROR });
  }
};

// Render Edit Category Page
const getEditCategoryPage = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) {
      return res.status(STATUS.NOT_FOUND).render("partials/errorPage", { errorMessage: MESSAGES.CATEGORY_NOT_FOUND });
    }

    res.status(STATUS.SUCCESS).render("admin/editCategory", {
      title: "Edit Category",
      category,
      admin: req.session.user,
      formData: {
        categoryOffer: category.categoryOffer?.percentage || "",
        categoryOfferStart: category.categoryOffer?.startDate
          ? category.categoryOffer.startDate.toISOString().split("T")[0]
          : "",
        categoryOfferEnd: category.categoryOffer?.endDate
          ? category.categoryOffer.endDate.toISOString().split("T")[0]
          : ""
      },
      errors: {}
    });

  } catch (error) {
    console.error("Error rendering edit page:", error);
    res.status(STATUS.SERVER_ERROR).render("partials/errorPage", { errorMessage: MESSAGES.SERVER_ERROR });
  }
};

// Update Category 
const editCategory = async (req, res) => {
  try {
    const { categoryName, description, categoryOffer, categoryOfferStart, categoryOfferEnd } = req.body;
    const categoryId = req.params.id;

    const category = await Category.findById(categoryId);
    if (!category) {
      return res.status(STATUS.NOT_FOUND).render("partials/errorPage", { errorMessage: MESSAGES.CATEGORY_NOT_FOUND });
    }

    const errors = {};

    if (!categoryName || categoryName.trim().length === 0) {
      errors.categoryName = MESSAGES.CATEGORY_NAME_REQUIRED;
    }
    if (description && description.length < 10) {
      errors.description = MESSAGES.CATEGORY_DESCRIPTION_SHORT;
    }
    if (categoryOffer && (categoryOffer < 0 || categoryOffer > 100)) {
      errors.categoryOffer = MESSAGES.CATEGORY_OFFER_INVALID;
    }

    const duplicate = await Category.findOne({
      categoryName: { $regex: new RegExp(`^${categoryName}$`, "i") },
      _id: { $ne: categoryId },
    });
    if (duplicate) {
      errors.categoryName = MESSAGES.CATEGORY_EXISTS;
    }

    if (Object.keys(errors).length > 0) {
      return res.status(STATUS.BAD_REQUEST).render("admin/editCategory", {
        title: "Edit Category",
        category,
        admin: req.session.user,
        errors,
      });
    }

    // Update fields
    category.categoryName = categoryName.trim();
    category.description = description;
    if (req.thumbnailUrl) category.thumbnail = req.thumbnailUrl;

    // Update offer
    if (categoryOffer !== undefined && categoryOffer !== "") {
      const offerPercent = Number(categoryOffer);
      const startDate = categoryOfferStart ? new Date(categoryOfferStart) : null;
      const endDate = categoryOfferEnd ? new Date(categoryOfferEnd) : null;
      const now = new Date();
      const isActive = (!startDate || startDate <= now) && (!endDate || endDate >= now);

      category.categoryOffer = {
        percentage: offerPercent,
        startDate,
        endDate,
        isActive,
      };
    } else {
      category.categoryOffer = { percentage: 0, startDate: null, endDate: null, isActive: false };
    }

    await category.save();
    res.redirect(`/admin/categories/edit/${category._id}?success=true`);

  } catch (error) {
    console.error("Error updating category:", error);
    res.status(STATUS.SERVER_ERROR).render("partials/errorPage", { errorMessage: MESSAGES.SERVER_ERROR });
  }
};

// Soft Delete Category 
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findByIdAndUpdate(id, { isActive: false });
    if (!category) {
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.CATEGORY_NOT_FOUND });
    }
    res.status(STATUS.SUCCESS).json({ success: true, message: MESSAGES.CATEGORY_DELETED });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};

// Toggle Listed/Unlisted 
const toggleCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await Category.findById(id);
    if (!category) {
      return res.status(STATUS.NOT_FOUND).json({ success: false, message: MESSAGES.CATEGORY_NOT_FOUND });
    }

    category.isListed = !category.isListed;
    await category.save();

    res.status(STATUS.SUCCESS).json({ success: true, isListed: category.isListed });
  } catch (error) {
    console.error("Error toggling category:", error);
    res.status(STATUS.SERVER_ERROR).json({ success: false, message: MESSAGES.SERVER_ERROR });
  }
};

export {
  getCategories,

  getAddCategoryPage,
  addCategory,

  getEditCategoryPage,
  editCategory,

  deleteCategory,
  toggleCategory
};
