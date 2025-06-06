(function($) {
    var _$current_slider;
    var _is_mousedown;
    var _original_mousex;
    var _is_left_grip;
    var _before_keydown_value;
    var _before_keydown_pixel;
    var _before_keyup_value;
    var _before_keyup_pixel;
    var _naked_bar_deltas;
    var _methods = {
        'setNakedBarDelta': function(position, handleWidth) {
            if (position === "stickToSides") {
                _naked_bar_deltas = {
                    toEndWidth: handleWidth,
                    toBeginLeft: 0,
                    toBeginWidth: handleWidth
                }
            } else if (position === "middle") {
                _naked_bar_deltas = {
                    toEndWidth: handleWidth / 2,
                    toBeginLeft: handleWidth / 2,
                    toBeginWidth: handleWidth / 2
                }
            } else {
                throw new Error('unknown position of setNakedBarDelta: ' + position)
            }
        },
        'getSliderValuesAtPositionPx': function(leftPx, rightPx) {
            var $this = this,
                leftPxInValue, rightPxInValue, pixel_to_value_mapping_func = $this.data('pixel_to_value_mapping');
            if (typeof pixel_to_value_mapping_func !== 'undefined') {
                leftPxInValue = pixel_to_value_mapping_func(leftPx);
                rightPxInValue = pixel_to_value_mapping_func(rightPx)
            } else {
                var w = _methods.getSliderWidthPx.call($this) - $this.data('left_grip_width');
                leftPxInValue = _methods.inverse_rangemap_0_to_n.call($this, leftPx, w);
                rightPxInValue = _methods.inverse_rangemap_0_to_n.call($this, rightPx, w)
            }
            return [leftPxInValue, rightPxInValue]
        },
        'validateAndMoveGripsToPx': function(nextLeftGripPositionPx, nextRightGripPositionPx) {
            var $this = this;
            var draggableAreaLengthPx = _methods.getSliderWidthPx.call($this) - $this.data('left_grip_width');
            if (nextRightGripPositionPx <= draggableAreaLengthPx && nextLeftGripPositionPx >= 0 && nextLeftGripPositionPx <= draggableAreaLengthPx && (!$this.data('has_right_grip') || nextLeftGripPositionPx <= nextRightGripPositionPx)) {
                var prevMin = $this.data('cur_min'),
                    prevMax = $this.data('cur_max');
                _methods.set_position_from_px.call($this, nextLeftGripPositionPx, nextRightGripPositionPx);
                _methods.refresh_grips_style.call($this);
                _methods.notify_changed_implicit.call($this, 'drag_move', prevMin, prevMax)
            }
            return $this
        },
        'updateAriaAttributes': function() {
            var $this = this,
                settings = $this.data('settings'),
                $leftGrip = $this.find(settings.left_grip_selector);
            if ($this.data('has_right_grip')) {
                var $rightGrip = $this.find(settings.right_grip_selector);
                $leftGrip.attr('aria-valuemin', $this.data('range_min')).attr('aria-valuenow', methods.get_current_min_value.call($this)).attr('aria-valuemax', methods.get_current_max_value.call($this));
                $rightGrip.attr('aria-valuemin', methods.get_current_min_value.call($this)).attr('aria-valuenow', methods.get_current_max_value.call($this)).attr('aria-valuemax', $this.data('range_max'))
            } else {
                $leftGrip.attr('aria-valuemin', $this.data('range_min')).attr('aria-valuenow', methods.get_current_min_value.call($this)).attr('aria-valuemax', $this.data('range_max'))
            }
            return $this
        },
        'getSliderWidthPx': function() {
            var $this = this;
            return Math.round($this.width())
        },
        'getGripPositionPx': function($grip) {
            return parseInt($grip.css('left').replace('px', ''), 10)
        },
        'getLeftGripPositionPx': function() {
            var $this = this,
                settings = $this.data('settings'),
                $leftGrip = $this.find(settings.left_grip_selector);
            return _methods.getGripPositionPx.call($this, $leftGrip)
        },
        'getRightGripPositionPx': function() {
            var $this = this,
                settings = $this.data('settings');
            if ($this.data('has_right_grip')) {
                return _methods.getGripPositionPx.call($this, $this.find(settings.right_grip_selector))
            }
            var sliderWidthPx = _methods.getSliderWidthPx.call($this) - $this.data('left_grip_width');
            return _methods.rangemap_0_to_n.call($this, $this.data('cur_max'), sliderWidthPx)
        },
        'getLeftGripWidth': function() {
            var $this = this,
                settings = $this.data('settings'),
                $leftGrip = $this.find(settings.left_grip_selector);
            return Math.round($leftGrip.outerWidth())
        },
        'getRightGripWidth': function() {
            var $this = this,
                settings = $this.data('settings'),
                $rightGrip = $this.find(settings.right_grip_selector);
            return Math.round($rightGrip.outerWidth())
        },
        'binarySearchValueToPxCompareFunc': function(s, a, i) {
            if (s === a[i]) {
                return 0
            }
            if (s < a[i] && i === 0) {
                return 0
            }
            if (a[i - 1] <= s && s < a[i]) {
                return 0
            }
            if (s > a[i]) {
                return 1
            }
            if (s <= a[i - 1]) {
                return -1
            }
            $.error('cannot compare s: ' + s + ' with a[' + i + ']. a is: ' + a.join(','))
        },
        'binarySearch': function(array, searchElement, getElementFunc, compareFunc) {
            var minIndex = 0;
            var maxIndex = array.length - 1;
            var currentIndex;
            var currentElement;
            while (minIndex <= maxIndex) {
                currentIndex = (minIndex + maxIndex) / 2 | 0;
                currentElement = getElementFunc(array, currentIndex);
                var lt_eq_gt = compareFunc(searchElement, array, currentIndex);
                if (lt_eq_gt > 0) {
                    minIndex = currentIndex + 1
                } else if (lt_eq_gt < 0) {
                    maxIndex = currentIndex - 1
                } else {
                    return currentIndex
                }
            }
            return -1
        },
        'haveLimits': function() {
            var $this = this,
                lowerLimit = $this.data('lower-limit'),
                upperLimit = $this.data('upper-limit'),
                haveLimits = !1;
            if (typeof lowerLimit !== 'undefined' && typeof upperLimit !== 'undefined') {
                haveLimits = !0
            }
            return haveLimits
        },
        'refresh_grips_style': function() {
            var $this = this,
                settings = $this.data('settings');
            if (typeof settings.highlight === 'undefined') {
                return
            }
            var highlightedRangeMin = $this.data('highlightedRangeMin');
            if (typeof highlightedRangeMin === 'undefined') {
                return
            }
            var $leftGrip = $this.find(settings.left_grip_selector),
                $rightGrip = $this.find(settings.right_grip_selector),
                highlightedRangeMax = $this.data('highlightedRangeMax'),
                curMin = $this.data('cur_min'),
                curMax = $this.data('cur_max'),
                highlightGripClass = settings.highlight.grip_class;
            if (curMin < highlightedRangeMin || curMin > highlightedRangeMax) {
                $leftGrip.removeClass(highlightGripClass)
            } else {
                $leftGrip.addClass(highlightGripClass)
            }
            if (curMax < highlightedRangeMin || curMax > highlightedRangeMax) {
                $rightGrip.removeClass(highlightGripClass)
            } else {
                $rightGrip.addClass(highlightGripClass)
            }
        },
        'set_position_from_val': function(cur_min, cur_max) {
            var $this = this;
            var range_min = $this.data('range_min'),
                range_max = $this.data('range_max');
            if (cur_min < range_min) {
                cur_min = range_min
            }
            if (cur_min > range_max) {
                cur_min = range_max
            }
            if ($this.data('has_right_grip')) {
                if (cur_max > range_max) {
                    cur_max = range_max
                }
                if (cur_max < range_min) {
                    cur_max = range_min
                }
            } else {
                cur_max = $this.data('cur_max')
            }
            var leftPx = methods.value_to_px.call($this, cur_min),
                rightPx = methods.value_to_px.call($this, cur_max);
            _methods.set_handles_at_px.call($this, leftPx, rightPx);
            $this.data('cur_min', cur_min);
            if ($this.data('has_right_grip')) {
                $this.data('cur_max', cur_max)
            }
            return $this
        },
        'set_position_from_px': function(leftPx, rightPx) {
            var $this = this;
            _methods.set_handles_at_px.call($this, leftPx, rightPx);
            var valueLeftRight = _methods.getSliderValuesAtPositionPx.call($this, leftPx, rightPx),
                leftPxInValue = valueLeftRight[0],
                rightPxInValue = valueLeftRight[1];
            $this.data('cur_min', leftPxInValue);
            if ($this.data('has_right_grip')) {
                $this.data('cur_max', rightPxInValue)
            }
            return $this
        },
        'set_handles_at_px': function(leftPx, rightPx) {
            var $this = this;
            var settings = $this.data('settings');
            var left_grip_selector = settings.left_grip_selector,
                right_grip_selector = settings.right_grip_selector,
                value_bar_selector = settings.value_bar_selector;
            var handleWidth = $this.data('left_grip_width');
            $this.find(left_grip_selector).css('left', leftPx + 'px');
            $this.find(right_grip_selector).css('left', rightPx + 'px');
            if ($this.data('has_right_grip')) {
                $this.find(value_bar_selector).css('left', leftPx + 'px').css('width', (rightPx - leftPx + handleWidth) + 'px')
            } else {
                if (!_naked_bar_deltas) {
                    _methods.populateNakedBarDeltas.call($this, leftPx, rightPx, handleWidth)
                }
                if (rightPx > leftPx) {
                    $this.find(value_bar_selector).css('left', leftPx + 'px').css('width', rightPx - leftPx + _naked_bar_deltas.toEndWidth + 'px')
                } else {
                    $this.find(value_bar_selector).css('left', rightPx + _naked_bar_deltas.toBeginLeft + 'px').css('width', (leftPx - rightPx + _naked_bar_deltas.toBeginWidth) + 'px')
                }
            }
            return $this
        },
        'drag_start_func_touch': function(e, settings, $left_grip, $right_grip, is_touch) {
            var $this = this,
                original_event = e.originalEvent,
                touch = original_event.touches[0];
            var curY = touch.pageY,
                curX = touch.pageX;
            var ydelta = Math.abs($this.offset().top - curY),
                slider_left = $this.offset().left,
                xldelta = slider_left - curX,
                xrdelta = curX - (slider_left + $this.width());
            if (ydelta > settings.touch_tolerance_value_bar_y || xldelta > settings.touch_tolerance_value_bar_x || xrdelta > settings.touch_tolerance_value_bar_x) {
                return
            }
            original_event.preventDefault();
            _original_mousex = touch.pageX;
            _methods.drag_start_func.call($this, touch, settings, $left_grip, $right_grip, is_touch)
        },
        'drag_start_func': function(e, settings, $leftGrip, $rightGrip, is_touch) {
            var $this = this;
            $this.find(settings.left_grip_selector + ',' + settings.value_bar_selector + ',' + settings.right_grip_selector).removeClass(settings.animating_css_class);
            if (!methods.is_enabled.call($this)) {
                return
            }
            var $target = $(e.target);
            var targetIsPanelSelector = !1;
            if (typeof settings.highlight === 'object') {
                targetIsPanelSelector = $target.is(settings.highlight.panel_selector)
            }
            if (is_touch === !1 && !$target.is(settings.left_grip_selector) && !$target.is(settings.right_grip_selector) && !$target.is(settings.value_bar_selector) && !targetIsPanelSelector && !$target.is($this)) {
                return
            }
            _$current_slider = $this;
            var leftGripPositionPx = _methods.getGripPositionPx.call($this, $leftGrip),
                sliderWidthPx = _methods.getSliderWidthPx.call($this) - $this.data('left_grip_width'),
                lleft = $leftGrip.offset().left,
                rleft, curX, ldist, rdist, ldelta, rdelta;
            var rightGripPositionPx = _methods.getRightGripPositionPx.call($this);
            curX = Math.round(e.pageX) - ($this.data('left_grip_width') / 2);
            ldist = Math.abs(lleft - curX);
            ldelta = curX - lleft;
            if ($this.data('has_right_grip')) {
                rleft = $rightGrip.offset().left;
                rdist = Math.abs(rleft - curX);
                rdelta = curX - rleft
            } else {
                rdist = ldist * 2;
                rdelta = ldelta * 2
            }
            settings.user_drag_start_callback.call($this, e);
            if (ldist === rdist) {
                if (curX < lleft) {
                    leftGripPositionPx += ldelta;
                    _is_left_grip = !0
                } else {
                    rightGripPositionPx += rdelta;
                    _is_left_grip = !1
                }
            } else if (ldist < rdist) {
                leftGripPositionPx += ldelta;
                _is_left_grip = !0
            } else {
                rightGripPositionPx += rdelta;
                _is_left_grip = !1
            }
            if ($this.data('has_right_grip')) {
                if (rightGripPositionPx > sliderWidthPx) {
                    rightGripPositionPx = sliderWidthPx
                }
            } else {
                if (leftGripPositionPx > sliderWidthPx) {
                    leftGripPositionPx = sliderWidthPx
                }
            }
            if (leftGripPositionPx < 0) {
                leftGripPositionPx = 0
            }
            _is_mousedown = !0;
            var prev_min = $this.data('cur_min'),
                prev_max = $this.data('cur_max');
            _methods.set_position_from_px.call($this, leftGripPositionPx, rightGripPositionPx);
            _methods.refresh_grips_style.call($this);
            _methods.notify_changed_implicit.call($this, 'drag_start', prev_min, prev_max);
            if (Object.prototype.toString.apply(e) !== "[object Touch]") {
                e.preventDefault()
            }
        },
        'drag_move_func_touch': function(e) {
            if (_is_mousedown === !0) {
                var original_event = e.originalEvent;
                original_event.preventDefault();
                var touch = original_event.touches[0];
                _methods.drag_move_func(touch)
            }
        },
        'drag_move_func': function(e) {
            if (_is_mousedown) {
                var $this = _$current_slider,
                    settings = $this.data('settings'),
                    sliderWidthPx = _methods.getSliderWidthPx.call($this) - $this.data('left_grip_width'),
                    leftGripPositionPx = _methods.getLeftGripPositionPx.call($this);
                var rightGripPositionPx = _methods.getRightGripPositionPx.call($this);
                var absoluteMousePosition = Math.round(e.pageX);
                var delta = absoluteMousePosition - _original_mousex;
                var half_a_grip_width = $this.data('left_grip_width') / 2,
                    drag_area_start = $this.offset().left + $this.data('left_grip_width') - half_a_grip_width,
                    drag_area_end = drag_area_start + sliderWidthPx;
                if (settings.crossable_handles === !1 && $this.data('has_right_grip')) {
                    if (_is_left_grip) {
                        drag_area_end = drag_area_start + rightGripPositionPx
                    } else {
                        drag_area_start = drag_area_start + leftGripPositionPx
                    }
                }
                var ignore_positive_delta = 0,
                    ignore_negative_delta = 0;
                if (absoluteMousePosition < drag_area_start) {
                    ignore_positive_delta = 1;
                    ignore_negative_delta = 0
                }
                if (absoluteMousePosition > drag_area_end) {
                    ignore_negative_delta = 1;
                    ignore_positive_delta = 0
                }
                if (settings.crossable_handles === !0 && $this.data('has_right_grip')) {
                    if (_is_left_grip) {
                        if (rightGripPositionPx <= sliderWidthPx) {
                            if (leftGripPositionPx + delta > rightGripPositionPx) {
                                _is_left_grip = !1;
                                leftGripPositionPx = rightGripPositionPx
                            }
                        }
                    } else {
                        if (leftGripPositionPx >= 0) {
                            if (rightGripPositionPx + delta < leftGripPositionPx) {
                                _is_left_grip = !0;
                                rightGripPositionPx = leftGripPositionPx
                            }
                        }
                    }
                }
                var nextLeftGripPositionPx = leftGripPositionPx,
                    nextRightGripPositionPx = rightGripPositionPx;
                if ((delta > 0 && !ignore_positive_delta) || (delta < 0 && !ignore_negative_delta)) {
                    if (_is_left_grip) {
                        nextLeftGripPositionPx += delta
                    } else {
                        nextRightGripPositionPx += delta
                    }
                }
                _methods.validateAndMoveGripsToPx.call($this, nextLeftGripPositionPx, nextRightGripPositionPx);
                _original_mousex = absoluteMousePosition;
                if (Object.prototype.toString.apply(e) !== "[object Touch]") {
                    e.preventDefault()
                }
            }
        },
        'drag_end_func_touch': function(e) {
            var original_event = e.originalEvent;
            original_event.preventDefault();
            var touch = original_event.touches[0];
            _methods.drag_end_func(touch)
        },
        'drag_end_func': function() {
            var $this = _$current_slider;
            if (typeof $this !== 'undefined') {
                _is_mousedown = !1;
                _original_mousex = undefined;
                _methods.notify_mouse_up_implicit.call($this, _is_left_grip);
                _$current_slider = undefined;
                var settings = $this.data('settings');
                $this.find(settings.left_grip_selector + ',' + settings.value_bar_selector + ',' + settings.right_grip_selector).addClass(settings.animating_css_class)
            }
        },
        'get_rounding_for_value': function(v) {
            var $this = this;
            var rounding = $this.data('rounding');
            var rounding_ranges = $this.data('rounding_ranges');
            if (typeof rounding_ranges === 'object') {
                var roundingIdx = _methods.binarySearch.call($this, rounding_ranges, v, function(array, index) {
                    return array[index].range
                }, function(search, array, currentIdx) {
                    if (search < array[currentIdx].range) {
                        if (currentIdx > 0) {
                            if (search >= array[currentIdx - 1].range) {
                                return 0
                            } else {
                                return -1
                            }
                        } else {
                            return 0
                        }
                    } else {
                        return 1
                    }
                });
                rounding = 1;
                if (roundingIdx > -1) {
                    rounding = parseInt(rounding_ranges[roundingIdx].value, 10)
                } else {
                    var lastIdx = rounding_ranges.length - 1;
                    if (v >= rounding_ranges[lastIdx].range) {
                        rounding = rounding_ranges[lastIdx].value
                    }
                }
            }
            return rounding
        },
        'notify_mouse_up_implicit': function(isLeftGrip) {
            var $this = this,
                current_min_value = methods.get_current_min_value.call($this),
                current_max_value = methods.get_current_max_value.call($this),
                didValuesChange = !1;
            if (($this.data('beforestart_min') !== current_min_value) || ($this.data('beforestart_max') !== current_max_value)) {
                didValuesChange = !0;
                $this.data('beforestart_min', current_min_value);
                $this.data('beforestart_max', current_max_value)
            }
            var settings = $this.data('settings');
            settings.user_mouseup_callback.call($this, methods.get_current_min_value.call($this), methods.get_current_max_value.call($this), isLeftGrip, didValuesChange);
            return $this
        },
        'notify_changed_implicit': function(cause, prevMin, prevMax) {
            var $this = this;
            var force = !1;
            if (cause === 'init' || cause === 'refresh') {
                force = !0
            }
            var curMin = methods.get_current_min_value.call($this),
                curMax = methods.get_current_max_value.call($this);
            if (!force) {
                prevMin = methods.round_value_according_to_rounding.call($this, prevMin);
                prevMax = methods.round_value_according_to_rounding.call($this, prevMax)
            }
            if (force || curMin !== prevMin || curMax !== prevMax) {
                _methods.notify_changed_explicit.call($this, cause, prevMin, prevMax, curMin, curMax);
                force = 1
            }
            return force
        },
        'notify_changed_explicit': function(cause, prevMin, prevMax, curMin, curMax) {
            var $this = this,
                settings = $this.data('settings');
            if ($this.data('aria_enabled')) {
                _methods.updateAriaAttributes.call($this)
            }
            settings.value_changed_callback.call($this, cause, curMin, curMax, prevMin, prevMax);
            return $this
        },
        'validate_params': function(settings) {
            var $this = this;
            var min_value = $this.data('range_min'),
                max_value = $this.data('range_max'),
                cur_min = $this.data('cur_min'),
                lower_limit = $this.data('lower-limit'),
                upper_limit = $this.data('upper-limit');
            var have_limits = _methods.haveLimits.call($this);
            if (typeof min_value === 'undefined') {
                $.error("the data-range_min attribute was not defined")
            }
            if (typeof max_value === 'undefined') {
                $.error("the data-range_max attribute was not defined")
            }
            if (typeof cur_min === 'undefined') {
                $.error("the data-cur_min attribute must be defined")
            }
            if (min_value > max_value) {
                $.error("Invalid input parameter. must be min < max")
            }
            if (have_limits && lower_limit > upper_limit) {
                $.error('Invalid data-lower-limit or data-upper-limit')
            }
            if ($this.find(settings.left_grip_selector).length === 0) {
                $.error("Cannot find element pointed by left_grip_selector: " + settings.left_grip_selector)
            }
            if (typeof settings.right_grip_selector !== 'undefined') {
                if ($this.find(settings.right_grip_selector).length === 0) {
                    $.error("Cannot find element pointed by right_grip_selector: " + settings.right_grip_selector)
                }
            }
            if (typeof settings.value_bar_selector !== 'undefined') {
                if ($this.find(settings.value_bar_selector).length === 0) {
                    $.error("Cannot find element pointed by value_bar_selector" + settings.value_bar_selector)
                }
            }
        },
        'rangemap_0_to_n': function(val, n) {
            var $this = this;
            var rangeMin = $this.data('range_min');
            var rangeMax = $this.data('range_max');
            if (val <= rangeMin) {
                return 0
            }
            if (val >= rangeMax) {
                return n
            }
            return Math.floor((n * val - n * rangeMin) / (rangeMax - rangeMin))
        },
        'inverse_rangemap_0_to_n': function(val, max) {
            var $this = this;
            var rangeMin = $this.data('range_min');
            var rangeMax = $this.data('range_max');
            if (val <= 0) {
                return rangeMin
            }
            if (val >= max) {
                return rangeMax
            }
            var relativeMapping = (rangeMax - rangeMin) * val / max;
            return relativeMapping + rangeMin
        }
    };
    var methods = {
        'teardown': function() {
            var $this = this;
            $this.removeData();
            $(document).unbind('mousemove.nstSlider').unbind('mouseup.nstSlider');
            $this.parent().unbind('mousedown.nstSlider').unbind('touchstart.nstSlider').unbind('touchmove.nstSlider').unbind('touchend.nstSlider');
            $this.unbind('keydown.nstSlider').unbind('keyup.nstSlider');
            return $this
        },
        'init': function(options) {
            var settings = $.extend({
                'animating_css_class': 'nst-animating',
                'touch_tolerance_value_bar_y': 30,
                'touch_tolerance_value_bar_x': 15,
                'left_grip_selector': '.nst-slider-grip-left',
                'right_grip_selector': undefined,
                'highlight': undefined,
                'rounding': undefined,
                'value_bar_selector': undefined,
                'crossable_handles': !0,
                'value_changed_callback': function() {
                    return
                },
                'user_mouseup_callback': function() {
                    return
                },
                'user_drag_start_callback': function() {
                    return
                }
            }, options);
            var $document = $(document);
            $document.unbind('mouseup.nstSlider');
            $document.unbind('mousemove.nstSlider');
            $document.bind('mousemove.nstSlider', _methods.drag_move_func);
            $document.bind('mouseup.nstSlider', _methods.drag_end_func);
            return this.each(function() {
                var $this = $(this),
                    $container = $this.parent();
                $this.data('enabled', !0);
                var rangeMin = $this.data('range_min'),
                    rangeMax = $this.data('range_max'),
                    valueMin = $this.data('cur_min'),
                    valueMax = $this.data('cur_max');
                if (typeof valueMax === 'undefined') {
                    valueMax = valueMin
                }
                if (rangeMin === '') {
                    rangeMin = 0
                }
                if (rangeMax === '') {
                    rangeMax = 0
                }
                if (valueMin === '') {
                    valueMin = 0
                }
                if (valueMax === '') {
                    valueMax = 0
                }
                $this.data('range_min', rangeMin);
                $this.data('range_max', rangeMax);
                $this.data('cur_min', valueMin);
                $this.data('cur_max', valueMax);
                _methods.validate_params.call($this, settings);
                $this.data('settings', settings);
                if (typeof settings.rounding !== 'undefined') {
                    methods.set_rounding.call($this, settings.rounding)
                } else if (typeof $this.data('rounding') !== 'undefined') {
                    methods.set_rounding.call($this, $this.data('rounding'))
                } else {
                    methods.set_rounding.call($this, 1)
                }
                var left_grip = $this.find(settings.left_grip_selector)[0],
                    $left_grip = $(left_grip),
                    $right_grip = $($this.find(settings.right_grip_selector)[0]);
                if (typeof $left_grip.attr('tabindex') === 'undefined') {
                    $left_grip.attr('tabindex', 0)
                }
                var has_right_grip = !1;
                if ($this.find(settings.right_grip_selector).length > 0) {
                    has_right_grip = !0;
                    if (typeof $right_grip.attr('tabindex') === 'undefined') {
                        $right_grip.attr('tabindex', 0)
                    }
                }
                $this.data('has_right_grip', has_right_grip);
                if ($this.data('aria_enabled') === !0) {
                    $left_grip.attr('role', 'slider').attr('aria-disabled', 'false');
                    if (has_right_grip) {
                        $right_grip.attr('role', 'slider').attr('aria-disabled', 'false')
                    }
                }
                $this.bind('keyup.nstSlider', function(e) {
                    if ($this.data('enabled')) {
                        switch (e.which) {
                            case 37:
                            case 38:
                            case 39:
                            case 40:
                                if (_before_keydown_value === _before_keyup_value) {
                                    var searchUntil = _methods.getSliderWidthPx.call($this),
                                        val, i, setAtPixel;
                                    if (_before_keydown_pixel - _before_keyup_pixel < 0) {
                                        for (i = _before_keyup_pixel; i <= searchUntil; i++) {
                                            val = methods.round_value_according_to_rounding.call($this, _methods.getSliderValuesAtPositionPx.call($this, i, i)[1]);
                                            if (val !== _before_keyup_value) {
                                                setAtPixel = i;
                                                break
                                            }
                                        }
                                    } else {
                                        for (i = _before_keyup_pixel; i >= 0; i--) {
                                            val = methods.round_value_according_to_rounding.call($this, _methods.getSliderValuesAtPositionPx.call($this, i, i)[1]);
                                            if (val !== _before_keyup_value) {
                                                setAtPixel = i;
                                                break
                                            }
                                        }
                                    }
                                    if (_is_left_grip) {
                                        _methods.validateAndMoveGripsToPx.call($this, setAtPixel, _methods.getRightGripPositionPx.call($this))
                                    } else {
                                        _methods.validateAndMoveGripsToPx.call($this, _methods.getLeftGripPositionPx.call($this), setAtPixel)
                                    }
                                    _methods.notify_mouse_up_implicit.call($this, _is_left_grip)
                                }
                        }
                        _before_keydown_value = undefined;
                        _before_keydown_pixel = undefined;
                        _before_keyup_value = undefined;
                        _before_keyup_pixel = undefined
                    }
                });
                $this.bind('keydown.nstSlider', function(evt) {
                    if ($this.data('enabled')) {
                        var moveHandleBasedOnKeysFunc = function($grip, e) {
                            var nextLeft = _methods.getLeftGripPositionPx.call($this),
                                nextRight = _methods.getRightGripPositionPx.call($this);
                            if (typeof _before_keydown_value === 'undefined') {
                                _before_keydown_pixel = _is_left_grip ? nextLeft : nextRight;
                                _before_keydown_value = _is_left_grip ? methods.get_current_min_value.call($this) : methods.get_current_max_value.call($this)
                            }
                            switch (e.which) {
                                case 37:
                                case 40:
                                    if (_is_left_grip) {
                                        nextLeft--
                                    } else {
                                        nextRight--
                                    }
                                    e.preventDefault();
                                    break;
                                case 38:
                                case 39:
                                    if (_is_left_grip) {
                                        nextLeft++
                                    } else {
                                        nextRight++
                                    }
                                    e.preventDefault();
                                    break
                            }
                            _before_keyup_pixel = _is_left_grip ? nextLeft : nextRight;
                            _methods.validateAndMoveGripsToPx.call($this, nextLeft, nextRight);
                            _before_keyup_value = _is_left_grip ? methods.get_current_min_value.call($this) : methods.get_current_max_value.call($this)
                        };
                        if (has_right_grip && $this.find(':focus').is($right_grip)) {
                            _is_left_grip = !1;
                            moveHandleBasedOnKeysFunc.call($this, $right_grip, evt)
                        } else {
                            _is_left_grip = !0;
                            moveHandleBasedOnKeysFunc.call($this, $left_grip, evt)
                        }
                    }
                });
                var left_grip_width = _methods.getLeftGripWidth.call($this),
                    right_grip_width = has_right_grip ? _methods.getRightGripWidth.call($this) : left_grip_width;
                $this.data('left_grip_width', left_grip_width);
                $this.data('right_grip_width', right_grip_width);
                $this.data('value_bar_selector', settings.value_bar_selector);
                if (!has_right_grip) {
                    var bStickToSides = valueMax === rangeMax || valueMax === rangeMin;
                    _methods.setNakedBarDelta.call($this, bStickToSides ? "stickToSides" : "middle", left_grip_width)
                }
                if (rangeMin === rangeMax || valueMin === valueMax) {
                    methods.set_range.call($this, rangeMin, rangeMax)
                } else {
                    _methods.set_position_from_val.call($this, $this.data('cur_min'), $this.data('cur_max'))
                }
                _methods.notify_changed_implicit.call($this, 'init');
                $this.data('beforestart_min', methods.get_current_min_value.call($this));
                $this.data('beforestart_max', methods.get_current_max_value.call($this));
                $this.bind('mousedown.nstSlider', function(e) {
                    _methods.drag_start_func.call($this, e, settings, $left_grip, $right_grip, !1)
                });
                $container.bind('touchstart.nstSlider', function(e) {
                    _methods.drag_start_func_touch.call($this, e, settings, $left_grip, $right_grip, !0)
                });
                $container.bind('touchend.nstSlider', function(e) {
                    _methods.drag_end_func_touch.call($this, e)
                });
                $container.bind('touchmove.nstSlider', function(e) {
                    _methods.drag_move_func_touch.call($this, e)
                });
                var step_histogram = $this.data('histogram');
                if (typeof step_histogram !== 'undefined') {
                    methods.set_step_histogram.call($this, step_histogram)
                }
            })
        },
        'get_range_min': function() {
            var $this = this;
            return $this.data('range_min')
        },
        'get_range_max': function() {
            var $this = this;
            return $this.data('range_max')
        },
        'get_current_min_value': function() {
            var $this = $(this);
            var rangeMin = methods.get_range_min.call($this),
                rangeMax = methods.get_range_max.call($this);
            var currentMin = $this.data('cur_min');
            var min;
            if (rangeMin >= currentMin) {
                min = rangeMin
            } else {
                min = methods.round_value_according_to_rounding.call($this, currentMin)
            }
            if (_methods.haveLimits.call($this)) {
                if (min <= rangeMin) {
                    return $this.data('lower-limit')
                } else if (min >= rangeMax) {
                    return $this.data('upper-limit')
                }
            } else {
                if (min <= rangeMin) {
                    return rangeMin
                } else if (min >= rangeMax) {
                    return rangeMax
                }
            }
            return min
        },
        'get_current_max_value': function() {
            var $this = $(this);
            var rangeMin = methods.get_range_min.call($this),
                rangeMax = methods.get_range_max.call($this);
            var currentMax = $this.data('cur_max');
            var max;
            if (rangeMax <= currentMax) {
                max = rangeMax
            } else {
                max = methods.round_value_according_to_rounding.call($this, currentMax)
            }
            if (_methods.haveLimits.call($this)) {
                if (max >= rangeMax) {
                    return $this.data('upper-limit')
                } else if (max <= rangeMin) {
                    return $this.data('lower-limit')
                }
            } else {
                if (max >= rangeMax) {
                    return rangeMax
                } else if (max <= rangeMin) {
                    return rangeMin
                }
            }
            return max
        },
        'is_handle_to_left_extreme': function() {
            var $this = this;
            if (_methods.haveLimits.call($this)) {
                return $this.data('lower-limit') === methods.get_current_min_value.call($this)
            } else {
                return methods.get_range_min.call($this) === methods.get_current_min_value.call($this)
            }
        },
        'is_handle_to_right_extreme': function() {
            var $this = this;
            if (_methods.haveLimits.call($this)) {
                return $this.data('upper-limit') === methods.get_current_max_value.call($this)
            } else {
                return methods.get_range_max.call($this) === methods.get_current_max_value.call($this)
            }
        },
        'refresh': function() {
            var $this = this;
            var lastStepHistogram = $this.data('last_step_histogram');
            if (typeof lastStepHistogram !== 'undefined') {
                methods.set_step_histogram.call($this, lastStepHistogram)
            }
            _methods.set_position_from_val.call($this, methods.get_current_min_value.call($this), methods.get_current_max_value.call($this));
            var highlightRangeMin = $this.data('highlightedRangeMin');
            if (typeof highlightRangeMin === 'number') {
                var highlightRangeMax = $this.data('highlightedRangeMax');
                methods.highlight_range.call($this, highlightRangeMin, highlightRangeMax)
            }
            _methods.notify_changed_implicit.call($this, 'refresh');
            return $this
        },
        'disable': function() {
            var $this = this,
                settings = $this.data('settings');
            $this.data('enabled', !1).find(settings.left_grip_selector).attr('aria-disabled', 'true').end().find(settings.right_grip_selector).attr('aria-disabled', 'true');
            return $this
        },
        'enable': function() {
            var $this = this,
                settings = $this.data('settings');
            $this.data('enabled', !0).find(settings.left_grip_selector).attr('aria-disabled', 'false').end().find(settings.right_grip_selector).attr('aria-disabled', 'false');
            return $this
        },
        'is_enabled': function() {
            var $this = this;
            return $this.data('enabled')
        },
        'set_position': function(min, max) {
            var $this = this;
            var prev_min = $this.data('cur_min'),
                prev_max = $this.data('cur_max');
            if (min > max) {
                _methods.set_position_from_val.call($this, max, min)
            } else {
                _methods.set_position_from_val.call($this, min, max)
            }
            _methods.refresh_grips_style.call($this);
            _methods.notify_changed_implicit.call($this, 'set_position', prev_min, prev_max);
            $this.data('beforestart_min', min);
            $this.data('beforestart_max', max)
        },
        'set_step_histogram': function(histogram) {
            var $this = this;
            $this.data('last_step_histogram', histogram);
            if (typeof histogram === 'undefined') {
                $.error('got an undefined histogram in set_step_histogram');
                _methods.unset_step_histogram.call($this)
            }
            var sliderWidthPx = _methods.getSliderWidthPx.call($this) - $this.data('left_grip_width'),
                nbuckets = histogram.length;
            if (sliderWidthPx <= 0) {
                return
            }
            var i;
            var histogram_sum = 0;
            for (i = 0; i < nbuckets; i++) {
                histogram_sum += histogram[i]
            }
            if (histogram_sum === 0) {
                methods.unset_step_histogram.call($this);
                return $this
            }
            var coeff = parseFloat(histogram_sum) / sliderWidthPx;
            for (i = 0; i < nbuckets; i++) {
                histogram[i] = histogram[i] / coeff
            }
            var cdf = [histogram[0]];
            for (i = 1; i < nbuckets; i++) {
                var cdf_x = cdf[i - 1] + histogram[i];
                cdf.push(cdf_x)
            }
            cdf.push(sliderWidthPx);
            var pixel_to_value_lookup = [$this.data('range_min')];
            var last_filled = 0;
            var last_price_for_cdf_bucket = pixel_to_value_lookup[0];
            var cdf_bucket_count = 0;
            while (last_filled <= sliderWidthPx) {
                var fill_up_to_px = parseInt(cdf.shift(), 10);
                var price_for_cdf_bucket = _methods.inverse_rangemap_0_to_n.call($this, cdf_bucket_count + 1, nbuckets + 1);
                cdf_bucket_count++;
                var fill_tot = fill_up_to_px - last_filled;
                var diff = price_for_cdf_bucket - last_price_for_cdf_bucket;
                for (i = last_filled; i < fill_up_to_px; i++) {
                    var next_price_for_cdf_bucket = last_price_for_cdf_bucket + (diff * (i - last_filled + 1) / fill_tot);
                    pixel_to_value_lookup.push(next_price_for_cdf_bucket);
                    last_filled++;
                    last_price_for_cdf_bucket = next_price_for_cdf_bucket
                }
                if (last_filled === sliderWidthPx) {
                    break
                }
            }
            pixel_to_value_lookup[pixel_to_value_lookup.length - 1] = $this.data('range_max');
            var pixel_to_value_mapping = function(pixel) {
                return pixel_to_value_lookup[parseInt(pixel, 10)]
            };
            var value_to_pixel_mapping = function(value) {
                var suggestedPixel = _methods.binarySearch.call($this, pixel_to_value_lookup, value, function(a, i) {
                    return a[i]
                }, _methods.binarySearchValueToPxCompareFunc);
                if (pixel_to_value_lookup[suggestedPixel] === value) {
                    return suggestedPixel
                }
                if (Math.abs(pixel_to_value_lookup[suggestedPixel - 1] - value) < Math.abs(pixel_to_value_lookup[suggestedPixel] - value)) {
                    return suggestedPixel - 1
                }
                return suggestedPixel
            };
            $this.data('pixel_to_value_mapping', pixel_to_value_mapping);
            $this.data('value_to_pixel_mapping', value_to_pixel_mapping);
            return $this
        },
        'unset_step_histogram': function() {
            var $this = this;
            $this.removeData('pixel_to_value_mapping');
            $this.removeData('value_to_pixel_mapping');
            $this.removeData('last_step_histogram');
            return $this
        },
        'set_range': function(rangeMin, rangeMax) {
            var $this = this;
            var oldMin = methods.get_current_min_value.call($this),
                oldMax = methods.get_current_max_value.call($this);
            $this.data('range_min', rangeMin);
            $this.data('range_max', rangeMax);
            _methods.set_position_from_val.call($this, oldMin, oldMax);
            _methods.notify_changed_implicit.call($this, 'set_range', oldMin, oldMax);
            return $this
        },
        'highlight_range': function(rangeMin, rangeMax) {
            var $this = this;
            var settings = $this.data('settings');
            if (typeof settings.highlight === "undefined") {
                $.error('you cannot call highlight_range if you haven\' specified the "highlight" parameter in construction!')
            }
            if (!rangeMin) {
                rangeMin = 0
            }
            if (!rangeMax) {
                rangeMax = 0
            }
            var leftPx = methods.value_to_px.call($this, rangeMin),
                rightPx = methods.value_to_px.call($this, rangeMax),
                barWidth = rightPx - leftPx + $this.data('left_grip_width');
            var $highlightPanel = $this.find(settings.highlight.panel_selector);
            $highlightPanel.css('left', leftPx + "px");
            $highlightPanel.css('width', barWidth + "px");
            $this.data('highlightedRangeMin', rangeMin);
            $this.data('highlightedRangeMax', rangeMax);
            _methods.refresh_grips_style.call($this);
            return $this
        },
        'set_rounding': function(rounding) {
            var $this = this;
            if (typeof rounding === 'string' && rounding.indexOf('{') > -1) {
                rounding = $.parseJSON(rounding)
            }
            $this.data('rounding', rounding);
            var roundings_array = [];
            if (typeof rounding === 'object') {
                var rounding_value;
                for (rounding_value in rounding) {
                    if (rounding.hasOwnProperty(rounding_value)) {
                        var rounding_range = rounding[rounding_value];
                        roundings_array.push({
                            'range': rounding_range,
                            'value': rounding_value
                        })
                    }
                }
                roundings_array.sort(function(a, b) {
                    return a.range - b.range
                });
                $this.data('rounding_ranges', roundings_array)
            } else {
                $this.removeData('rounding_ranges')
            }
            return $this
        },
        'get_rounding': function() {
            var $this = this;
            return $this.data('rounding')
        },
        'round_value_according_to_rounding': function(v) {
            var $this = this;
            var rounding = _methods.get_rounding_for_value.call($this, v);
            if (rounding > 0) {
                var increment = v / rounding;
                var increment_int = parseInt(increment, 10);
                var delta = increment - increment_int;
                if (delta > 0.5) {
                    increment_int++
                }
                var rounded = increment_int * rounding;
                return rounded
            } else {
                $.error('rounding must be > 0, got ' + rounding + ' instead')
            }
            return v
        },
        'value_to_px': function(value) {
            var $this = this,
                value_to_pixel_mapping_func = $this.data('value_to_pixel_mapping');
            if (typeof value_to_pixel_mapping_func !== 'undefined') {
                return value_to_pixel_mapping_func(value)
            }
            var w = _methods.getSliderWidthPx.call($this) - $this.data('left_grip_width');
            return _methods.rangemap_0_to_n.call($this, value, w)
        }
    };
    var __name__ = 'nstSlider';
    $.fn[__name__] = function(method) {
        if (methods[method]) {
            if (this.data('initialized') === !0) {
                return methods[method].apply(this, Array.prototype.slice.call(arguments, 1))
            } else {
                throw new Error('method ' + method + ' called on an uninitialized instance of ' + __name__)
            }
        } else if (typeof method === 'object' || !method) {
            this.data('initialized', !0);
            return methods.init.apply(this, arguments)
        } else {
            $.error('Cannot call method ' + method)
        }
    }
})(jQuery)