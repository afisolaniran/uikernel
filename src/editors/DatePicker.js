/*
 * Copyright (с) 2015-present, SoftIndex LLC.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import DatePicker from 'react-datepicker';
import moment from 'moment';
import PropTypes from 'prop-types';
import {omit} from '../common/utils';

class DatePickerEditor extends React.Component {
  static propTypes = {
    format: PropTypes.string,
    textFormat: PropTypes.string,
    min: PropTypes.any,
    max: PropTypes.any,
    value: PropTypes.any,
    show: PropTypes.bool,
    onBlur: PropTypes.func,
    onChange: PropTypes.func.isRequired
  };

  static defaultProps = {
    textFormat: 'YYYY-MM-DD'
  };

  onChange(date) {
    if (date) {
      date = date.format(this.props.format);
    }
    this.props.onChange(date);
  }

  render() {
    const otherProps = omit(this.props, ['textFormat', 'value', 'onChange', 'min', 'max']);
    return (
      <DatePicker
        {...otherProps}
        dateFormat={this.props.textFormat}
        selected={this.props.value && moment(this.props.value)}
        onChange={::this.onChange}
        minDate={this.props.min && moment(this.props.min)}
        maxDate={this.props.max && moment(this.props.max)}
        todayButton={'Today'}
      />
    );
  }
}

export default DatePickerEditor;
