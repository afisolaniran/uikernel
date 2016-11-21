/**
 * Copyright (с) 2015, SoftIndex LLC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @providesModule UIKernel
 */

'use strict';

var React = require('react');
var utils = require('../../common/utils');
var ValidationErrors = require('../../common/validation/ValidationErrors');

var GridDataMixin = {
  propTypes: {
    saveFullRecord: React.PropTypes.bool,
    partialErrorChecking: React.PropTypes.bool,
    warningsValidator: React.PropTypes.shape({
      isValidRecord: React.PropTypes.func,
      getValidationDependency: React.PropTypes.func
    })
  },

  getDefaultProps: function () {
    return {
      partialErrorChecking: false
    };
  },

  getInitialState: function () {
    this._loadData = utils.throttle(this._loadData);
    this._validateRow = utils.throttle(this._validateRow);
    this._checkWarnings = utils.throttle(this._checkWarnings);
    return {
      data: null,
      changes: {},
      warnings: {},
      errors: {},
      totals: {},
      recordsInfo: {},
      mainIds: [],
      partialErrorChecking: this.props.partialErrorChecking
    };
  },

  /**
   * Change table record
   * This method marks changed fields and validates them
   *
   * @param {*}         recordId    Record ID
   * @param {Object}    data        Changed data
   * @param {Function}  cb          CallBack function
   */
  set: function (recordId, data, cb) {
    var row = this._getRowID(recordId);
    this._setRowChanges(row, utils.cloneDeep(data), cb);
  },

  /**
   * Get record data
   *
   * @param recordId
   * @return {Object}
   */
  getRecord: function (recordId) {
    var row = this._getRowID(recordId);
    return utils.cloneDeep(this._getRecord(row));
  },

  /**
   * Get record changes object
   *
   * @param   {*} recordId Record ID
   * @return  {Object}
   */
  getRecordChanges: function (recordId) {
    var row = this._getRowID(recordId);
    return this._getRecordChanges(row);
  },

  /**
   * Get record warnings object
   *
   * @param   {*} recordId  Record ID
   * @return  {ValidationErrors}
   * @private
   */
  getRecordWarnings: function (recordId) {
    var row = this._getRowID(recordId);
    return this.state.warnings[row] || new ValidationErrors();
  },

  /**
   * Get validation warnings
   *
   * @return {Array|null}
   */
  getWarnings: function () {
    var result = [];
    var i;
    for (i in this.state.warnings) {
      result.push([
        this.state.recordsInfo[i].id,
        this.state.warnings[i]
      ]);
    }
    return result.length ? result : null;
  },

  /**
   * Get record errors object
   *
   * @param   {*} recordId  Record ID
   * @return  {ValidationErrors}
   * @private
   */
  getRecordErrors: function (recordId) {
    var row = this._getRowID(recordId);
    return this._getRecordErrors(row);
  },

  /**
   * Get validation errors
   *
   * @return {Array|null}
   */
  getErrors: function () {
    var result = [];
    var i;
    for (i in this.state.errors) {
      result.push([
        this.state.recordsInfo[i].id,
        this.state.errors[i]
      ]);
    }
    return result.length ? result : null;
  },

  /**
   * Get table model
   *
   * @returns {AbstractGridModel}
   */
  getModel: function () {
    return this.props.model;
  },

  /**
   * Save grid changes
   *
   * @param {Function} cb CallBack function
   */
  save: function (cb) {
    var errors = this.getErrors();

    // Collect all valid changes
    var changes = utils.reduce(this.state.changes, function (result, rowChanges, row) {
      if (!errors || !errors[row]) {
        if (this.props.saveFullRecord) {
          result[row] = this._getRecord(row);
        } else {
          result[row] = {};
          utils.assign(result[row], rowChanges, utils.pick(
            this.state.data[row],
            this.props.model.getValidationDependency(Object.keys(result[row]))
          ));
        }
      }
      return result;
    }.bind(this), {});

    // Cancel new record display
    this.removeRecordStatusAll('new');

    // Pass changes to table model processing
    this.props.model.update(this._dataObjectToArray(changes), function (err, data) {
      if (!this._isMounted) {
        return;
      }

      if (err) {
        return cb(err);
      }

      this.state.partialErrorChecking = false;

      data.forEach(function (record) {
        var row = this._getRowID(record[0]);

        // Skip records that are user changed while data processing
        if (!utils.isEqual(this.state.changes[row], changes[row])) {
          return;
        }

        // Process validation errors
        if (record[1] instanceof ValidationErrors) {
          this.state.errors[row] = record[1];
          return;
        }

        // Cancel changed data status of the parameters, that are changed
        utils.forEach(changes[row], function (value, field) {
          if (utils.isEqual(value, this.state.changes[row][field])) {
            delete this.state.changes[row][field];
          }
        }, this);

        // Clear changed data row if it's empty
        if (utils.isEmpty(this.state.changes[row])) {
          delete this.state.changes[row];
          if (!this._isMainRow(row)) {
            this._removeRecord(row);
          }
        }
      }.bind(this));

      this._renderBody();

      if (typeof cb === 'function') {
        cb(null, data);
      }
    }.bind(this));
  },

  /**
   * Clear record changes
   *
   * @param {*} recordId Record ID
   */
  clearRecordChanges: function (recordId) {
    var row = this._getRowID(recordId);

    delete this.state.changes[row];
    delete this.state.warnings[row];
    delete this.state.errors[row];

    this._updateRow(row);
  },

  /**
   * Clear all table changes
   */
  clearAllChanges: function () {
    var i;
    for (i in this.state.data) {
      if (!this._isMainRow(i)) {
        delete this.state.data[i];
        delete this.state.recordsInfo[i];
      }
    }
    this.state.changes = {};
    this.state.statuses = {};
    this.state.warnings = {};
    this.state.errors = {};
    this.state.partialErrorChecking = this.props.partialErrorChecking;

    this._renderBody();
  },

  /**
   * Reset to initial table state
   */
  reset: function () {
    this._setPage(0);
    if (!this._isSortingPropsMode()) {
      this._resetSorting();
    }
    this.updateTable();
  },

  /**
   * Get record changes object
   *
   * @param   {string}        row     Row ID
   * @return  {Object}
   */
  _getRecordChanges: function (row) {
    if (this.state.changes.hasOwnProperty(row)) {
      return utils.cloneDeep(this.state.changes[row]);
    }
    return {};
  },

  /**
   * Set record data
   *
   * @param {*}       recordId  Record ID
   * @param {Object}  data      Data
   * @private
   */
  _setRecordData: function (recordId, data) {
    if (!this._isRecordLoaded(recordId)) {
      return;
    }

    // TODO done through _dataArrayToObject
    var field;
    var row = this._getRowID(recordId);

    // Apply and redraw all record changes
    for (field in data) {
      this.state.data[row][field] = utils.cloneDeep(data[field]);
      this._renderBinds(row, field);
    }
  },

  /**
   * Table row has warning flag
   *
   * @param   {string}        row     Row ID
   * @param   {Array|string}  fields
   * @returns {boolean}
   * @private
   */
  _hasWarning: function (row, fields) {
    return this._checkFieldInValidation(row, fields, this.state.warnings);
  },

  /**
   * Table row has error flag
   *
   * @param   {string}        row     Row ID
   * @param   {Array|string}  fields
   * @returns {boolean}
   * @private
   */
  _hasError: function (row, fields) {
    return this._checkFieldInValidation(row, fields, this.state.errors);
  },

  /**
   * Table row has error in "validation" object
   *
   * @param   {string}        row
   * @param   {Array|string}  fields
   * @param   {Validation}    validation
   * @returns {boolean}
   * @private
   */
  _checkFieldInValidation: function (row, fields, validation) {
    var i;

    if (!validation[row]) {
      return false;
    }

    if (this.state.partialErrorChecking && !this.state.changes.hasOwnProperty(row)) {
      return false;
    }

    if (!Array.isArray(fields)) {
      fields = [fields];
    }

    for (i = 0; i < fields.length; i++) {
      if (validation[row].hasError(fields[i])) {
        return true;
      }
    }
    return false;
  },

  /**
   * Table row changed flag
   *
   * @param   {string}        row         Row ID
   * @param   {Array|string}  [fields]
   * @return  {boolean}
   * @private
   */
  _isChanged: function (row, fields) {
    var i;
    if (!this.state.changes[row]) {
      return false;
    }

    if (fields) {
      if (!Array.isArray(fields)) {
        fields = [fields];
      }
      for (i = 0; i < fields.length; i++) {
        if (this.state.changes[row].hasOwnProperty(fields[i])) {
          return true;
        }
      }
      return false;
    }

    return true;
  },

  /**
   * Get table row errors object
   *
   * @param   {string} row  Row ID
   * @return  {ValidationErrors}
   * @private
   */
  _getRecordErrors: function (row) {
    return this.state.errors[row] || new ValidationErrors();
  },

  /**
   * Pass changes to the table
   * This method marks changed fields
   *
   * @param {string}      row         Row ID
   * @param {Object}      data        Changed data
   * @private
   */
  _setRowChanges: function (row, data) {
    var changes = this.state.changes;

    if (!changes[row]) {
      changes[row] = {};
    }

    changes[row] = utils.getRecordChanges(this.props.model, this.state.data[row], changes[row], data);

    if (utils.isEmpty(changes[row])) {
      delete changes[row];
    } else {
      // Redraw the changes in the row
      utils.forEach(changes[row], function (value, field) {
        this._renderBinds(row, field);
      }, this);
    }
  },

  /**
   * Get table record
   *
   * @param {string} row Row ID
   * @returns {Object} Required table data record
   * @private
   */
  _getRecord: function (row) {
    if (this.state.data[row]) {
      return utils.assign({}, this.state.data[row], this.state.changes[row]);
    }
    return null;
  },

  /**
   * Set table data
   *
   * @param {Array}  changes  Changes
   * @private
   */
  _setData: function (changes) {
    var i;

    // Apply all changes
    for (i = 0; i < changes.length; i++) {
      this._setRecordData(changes[i][0], changes[i][1]);
    }
  },

  /**
   * Get record field title that changes column Editor
   *
   * @param       {string}        id  Column ID
   * @returns     {Array|string}     Fields that change Editor
   * @private
   */
  _getBindParam: function (id) {
    return this.props.cols[id].editorField || id;
  },

  /**
   * This method converts data array to the object with keys presented as record ID hash
   *
   * @param   {Array}    arr     Data array
   * @returns {Object}    Object result
   * @private
   */
  _dataArrayToObject: function (arr) {
    var i;
    var records = {};
    var info = {};
    var row;

    for (i = 0; i < arr.length; i++) {
      row = utils.hash(arr[i][0]);
      records[row] = arr[i][1];
      info[row] = {
        id: arr[i][0],
        index: i // Sort index
      };
    }

    return {
      records: records,
      info: info
    };
  },

  /**
   * This method converts data object to the array with keys presented as record ID hash
   *
   * @param   {Object}  obj     Data object
   * @returns {Array}   Array result
   * @private
   */
  _dataObjectToArray: function (obj) {
    var i;
    var arr = [];

    for (i in obj) {
      arr.push([
        this.state.recordsInfo[i].id,
        utils.clone(obj[i])
      ]);
    }

    return arr;
  },

  /**
   * Is main table row flag
   *
   * @param   {string}    row     Row ID
   * @return  {boolean}
   * @private
   */
  _isMainRow: function (row) {
    return this.state.mainIds.indexOf(row) >= 0;
  },

  _isRecordLoaded: function (recordId) {
    // TODO Can be optimized
    var row = utils.hash(recordId);
    return this.state.data.hasOwnProperty(row);
  },

  /**
   * Get table row ID having record ID
   *
   * @param   {*}       recordId    Record ID
   * @return  {string}  Row ID
   * @private
   */
  _getRowID: function (recordId) {
    var row = utils.hash(recordId);

    if (!this.state.data.hasOwnProperty(row)) {
      throw Error('Record with the ID is not contained in the table.');
    }

    return row;
  },

  /**
   * Load model data
   *
   * @param {Object}      settings    Request parameters
   * @param {Function}    cb          CallBack function
   * @private
   */
  _loadData: function (settings, cb) {
    this.props.model.read(settings, function (err, data) {
      if (err && this.props.onError) {
        this.props.onError(err);
      }
      if (this.props.onPageLoad) {
        this.props.onPageLoad(data);
      }
      cb(err, data);
    }.bind(this));
  },

  /**
   * Find record IDs that need to be displayed additionally
   *
   * @return {Array} Additional IDs array
   * @private
   */
  _getAdditionalIds: function () {
    var additionalIds = this._getRecordsWithStatus();
    var id;
    for (var row in this.state.changes) {
      id = this.state.recordsInfo[row].id;
      if (additionalIds.indexOf(id) < 0) {
        additionalIds.push(id);
      }
    }
    return additionalIds;
  },

  _removeRecord: function (recordId, cb) {
    this._removeTR(recordId);
    this.unselectRecord(recordId, true);
    delete this.state.data[recordId];
    delete this.state.recordsInfo[recordId];
    delete this.state.changes[recordId];
    delete this.state.warnings[recordId];
    delete this.state.errors[recordId];
    delete this.state.editor[recordId];
    this.setState({
      data: this.state.data,
      changes: this.state.changes,
      warnings: this.state.warnings,
      errors: this.state.errors,
      editor: this.state.editor
    }, cb ? cb.bind(this) : null);
  },

  _checkWarnings: function (row, cb) {
    if (!this.props.warningsValidator) {
      if (cb) {
        cb();
      }
      return;
    }
    this._checkFieldInValidation(row, this.props.warningsValidator, this.state.warnings, cb);
  },

  _validateRow: function (row, cb) {
    this._checkValidatorErrors(row, this.props.model, this.state.errors, cb);
  },

  /**
   * Check errors in "validator" object
   *
   * @param {string}        row         Row ID
   * @param {Validator}     validator   Validator object
   * @param {Validation[]}  result      Result object
   * @param {Function}      cb          Callback
   * @private
   */
  _checkValidatorErrors: function (row, validator, result, cb) {
    var record = this._getRecordChanges(row);

    validator.isValidRecord(record, function (err, validErrors) {
      if (!err && utils.isEqual(record, this._getRecordChanges(row))) {
        if (validErrors.isEmpty()) {
          delete result[row];
        } else {
          result[row] = validErrors;
        }

        Object.keys(record).forEach(function (field) {
          this._renderBinds(row, field);
        }, this);
      }

      if (cb) {
        cb(err);
      }
    }.bind(this));
  },

  _onRecordCreated: function (recordId) {
    this.updateTable(function () {
      if (this._isRecordLoaded(recordId)) {
        this._checkWarnings(this._getRowID(recordId));
      }
    }.bind(this));
  }
};

module.exports = GridDataMixin;
