/**
 * Copyright (с) 2015-present, SoftIndex LLC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * Abstract List model
 * @constructor
 */
function AbstractListModel() {}

/**
 * Get data
 *
 * @param {string}    search  Search query
 * @abstract
 */
AbstractListModel.read = (/*search*/) => Promise.resolve([]);

/**
 * Get option name using ID
 *
 * @param {*}         id  Option ID
 */
AbstractListModel.getLabel = (/*id*/) => Promise.resolve('');

export default AbstractListModel;
