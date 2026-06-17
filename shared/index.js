"use strict";

module.exports = {
  ...require("./schemas/common"),
  ...require("./schemas/auth"),
  ...require("./schemas/user"),
  ...require("./schemas/trip"),
  ...require("./schemas/booking"),
  ...require("./schemas/message"),
  ...require("./schemas/notification"),
};
