(function( factory ) {
	if (typeof define !== 'undefined' && define.amd) {
		define([], factory);
	} else if (typeof module !== 'undefined' && module.exports) {
		module.exports = factory();
	} else {
		window.scrollMonitor = factory();
	}
})(function() {

	var isOnServer = (typeof window === 'undefined');
	var isInBrowser = !isOnServer;

	var scrollTop = function(element) {
		if (isOnServer) {
			return 0;
		}
		if (element === document.body) {
			return window.pageYOffset ||
				(document.documentElement && document.documentElement.scrollTop) ||
				document.body.scrollTop;
		} else {
			return element.scrollTop;
		}
	};


	var VISIBILITYCHANGE = 'visibilityChange';
	var ENTERVIEWPORT = 'enterViewport';
	var FULLYENTERVIEWPORT = 'fullyEnterViewport';
	var EXITVIEWPORT = 'exitViewport';
	var PARTIALLYEXITVIEWPORT = 'partiallyExitViewport';
	var LOCATIONCHANGE = 'locationChange';
	var STATECHANGE = 'stateChange';

	var eventTypes = [
		VISIBILITYCHANGE,
		ENTERVIEWPORT,
		FULLYENTERVIEWPORT,
		EXITVIEWPORT,
		PARTIALLYEXITVIEWPORT,
		LOCATIONCHANGE,
		STATECHANGE
	];

	var defaultOffsets = {top: 0, bottom: 0};

	var getViewportHeight = function (element) {
		if (isOnServer) {
			return 0;
		}
		if (element === document.body) {
			return window.innerHeight || document.documentElement.clientHeight;
		} else {
			return element.clientHeight;
		}
	};

	var getDocumentHeight = function (element) {
		if (isOnServer) {
			return 0;
		}

		if (element === document.body) {
			// jQuery approach
			// whichever is greatest
			return Math.max(
				document.body.scrollHeight, document.documentElement.scrollHeight,
				document.body.offsetHeight, document.documentElement.offsetHeight,
				document.documentElement.clientHeight
			);
		} else {
			return element.scrollHeight;
		}
	};

	function createRoot (containerElement) {

		var root = {};

		var watchers = [];

		root.viewportTop = null;
		root.viewportBottom = null;
		root.documentHeight = null;
		root.viewportHeight = getViewportHeight(containerElement);

		var previousDocumentHeight;
		var latestEvent;

		var calculateViewportI;
		function calculateViewport() {
			root.viewportTop = scrollTop(containerElement);
			root.viewportBottom = root.viewportTop + root.viewportHeight;
			root.documentHeight = getDocumentHeight(containerElement);
			if (root.documentHeight !== previousDocumentHeight) {
				calculateViewportI = watchers.length;
				while( calculateViewportI-- ) {
					watchers[calculateViewportI].recalculateLocation();
				}
				previousDocumentHeight = root.documentHeight;
			}
		}

		var updateAndTriggerWatchersI;
		function updateAndTriggerWatchers() {
			// update all watchers then trigger the events so one can rely on another being up to date.
			updateAndTriggerWatchersI = watchers.length;
			while( updateAndTriggerWatchersI-- ) {
				watchers[updateAndTriggerWatchersI].update();
			}

			updateAndTriggerWatchersI = watchers.length;
			while( updateAndTriggerWatchersI-- ) {
				watchers[updateAndTriggerWatchersI].triggerCallbacks();
			}

		}

		function recalculateWatchLocationsAndTrigger() {
			root.viewportHeight = getViewportHeight();
			calculateViewport();
			updateAndTriggerWatchers();
		}

		var recalculateAndTriggerTimer;
		function debouncedRecalcuateAndTrigger() {
			clearTimeout(recalculateAndTriggerTimer);
			recalculateAndTriggerTimer = setTimeout( recalculateWatchLocationsAndTrigger, 100 );
		}

		function ElementWatcher( watchItem, offsets ) {
			var self = this;

			this.watchItem = watchItem;

			if (!offsets) {
				this.offsets = defaultOffsets;
			} else if (offsets === +offsets) {
				this.offsets = {top: offsets, bottom: offsets};
			} else {
				this.offsets = {
					top: offsets.top || defaultOffsets.top,
					bottom: offsets.bottom || defaultOffsets.bottom
				};
			}

			this.callbacks = {}; // {callback: function, isOne: true }

			for (var i = 0, j = eventTypes.length; i < j; i++) {
				self.callbacks[eventTypes[i]] = [];
			}

			this.locked = false;

			var wasInViewport;
			var wasFullyInViewport;
			var wasAboveViewport;
			var wasBelowViewport;

			var listenerToTriggerListI;
			var listener;
			function triggerCallbackArray( listeners ) {
				if (listeners.length === 0) {
					return;
				}
				listenerToTriggerListI = listeners.length;
				while( listenerToTriggerListI-- ) {
					listener = listeners[listenerToTriggerListI];
					listener.callback.call( self, latestEvent );
					if (listener.isOne) {
						listeners.splice(listenerToTriggerListI, 1);
					}
				}
			}
			this.triggerCallbacks = function triggerCallbacks() {

				if (this.isInViewport && !wasInViewport) {
					triggerCallbackArray( this.callbacks[ENTERVIEWPORT] );
				}
				if (this.isFullyInViewport && !wasFullyInViewport) {
					triggerCallbackArray( this.callbacks[FULLYENTERVIEWPORT] );
				}


				if (this.isAboveViewport !== wasAboveViewport &&
					this.isBelowViewport !== wasBelowViewport) {

					triggerCallbackArray( this.callbacks[VISIBILITYCHANGE] );

					// if you skip completely past this element
					if (!wasFullyInViewport && !this.isFullyInViewport) {
						triggerCallbackArray( this.callbacks[FULLYENTERVIEWPORT] );
						triggerCallbackArray( this.callbacks[PARTIALLYEXITVIEWPORT] );
					}
					if (!wasInViewport && !this.isInViewport) {
						triggerCallbackArray( this.callbacks[ENTERVIEWPORT] );
						triggerCallbackArray( this.callbacks[EXITVIEWPORT] );
					}
				}

				if (!this.isFullyInViewport && wasFullyInViewport) {
					triggerCallbackArray( this.callbacks[PARTIALLYEXITVIEWPORT] );
				}
				if (!this.isInViewport && wasInViewport) {
					triggerCallbackArray( this.callbacks[EXITVIEWPORT] );
				}
				if (this.isInViewport !== wasInViewport) {
					triggerCallbackArray( this.callbacks[VISIBILITYCHANGE] );
				}
				switch( true ) {
					case wasInViewport !== this.isInViewport:
					case wasFullyInViewport !== this.isFullyInViewport:
					case wasAboveViewport !== this.isAboveViewport:
					case wasBelowViewport !== this.isBelowViewport:
						triggerCallbackArray( this.callbacks[STATECHANGE] );
				}

				wasInViewport = this.isInViewport;
				wasFullyInViewport = this.isFullyInViewport;
				wasAboveViewport = this.isAboveViewport;
				wasBelowViewport = this.isBelowViewport;

			};

			this.recalculateLocation = function() {
				if (this.locked) {
					return;
				}
				var previousTop = this.top;
				var previousBottom = this.bottom;
				if (this.watchItem.nodeName) { // a dom element
					var cachedDisplay = this.watchItem.style.display;
					if (cachedDisplay === 'none') {
						this.watchItem.style.display = '';
					}

					var boundingRect = this.watchItem.getBoundingClientRect();
					this.top = boundingRect.top + root.viewportTop;
					this.bottom = boundingRect.bottom + root.viewportTop;

					if (cachedDisplay === 'none') {
						this.watchItem.style.display = cachedDisplay;
					}

				} else if (this.watchItem === +this.watchItem) { // number
					if (this.watchItem > 0) {
						this.top = this.bottom = this.watchItem;
					} else {
						this.top = this.bottom = root.documentHeight - this.watchItem;
					}

				} else { // an object with a top and bottom property
					this.top = this.watchItem.top;
					this.bottom = this.watchItem.bottom;
				}

				this.top -= this.offsets.top;
				this.bottom += this.offsets.bottom;
				this.height = this.bottom - this.top;

				if ( (previousTop !== undefined || previousBottom !== undefined) && (this.top !== previousTop || this.bottom !== previousBottom) ) {
					triggerCallbackArray( this.callbacks[LOCATIONCHANGE] );
				}
			};

			this.recalculateLocation();
			this.update();

			wasInViewport = this.isInViewport;
			wasFullyInViewport = this.isFullyInViewport;
			wasAboveViewport = this.isAboveViewport;
			wasBelowViewport = this.isBelowViewport;
		}

		ElementWatcher.prototype = {
			on: function( event, callback, isOne ) {

				// trigger the event if it applies to the element right now.
				switch( true ) {
					case event === VISIBILITYCHANGE && !this.isInViewport && this.isAboveViewport:
					case event === ENTERVIEWPORT && this.isInViewport:
					case event === FULLYENTERVIEWPORT && this.isFullyInViewport:
					case event === EXITVIEWPORT && this.isAboveViewport && !this.isInViewport:
					case event === PARTIALLYEXITVIEWPORT && this.isAboveViewport:
						callback.call( this, latestEvent );
						if (isOne) {
							return;
						}
				}

				if (this.callbacks[event]) {
					this.callbacks[event].push({callback: callback, isOne: isOne||false});
				} else {
					throw new Error('Tried to add a scroll monitor listener of type '+event+'. Your options are: '+eventTypes.join(', '));
				}
			},
			off: function( event, callback ) {
				if (this.callbacks[event]) {
					for (var i = 0, item; item = this.callbacks[event][i]; i++) {
						if (item.callback === callback) {
							this.callbacks[event].splice(i, 1);
							break;
						}
					}
				} else {
					throw new Error('Tried to remove a scroll monitor listener of type '+event+'. Your options are: '+eventTypes.join(', '));
				}
			},
			one: function( event, callback ) {
				this.on( event, callback, true);
			},
			recalculateSize: function() {
				this.height = this.watchItem.offsetHeight + this.offsets.top + this.offsets.bottom;
				this.bottom = this.top + this.height;
			},
			update: function() {
				this.isAboveViewport = this.top < root.viewportTop;
				this.isBelowViewport = this.bottom > root.viewportBottom;

				this.isInViewport = (this.top <= root.viewportBottom && this.bottom >= root.viewportTop);
				this.isFullyInViewport = (this.top >= root.viewportTop && this.bottom <= root.viewportBottom) || (this.isAboveViewport && this.isBelowViewport);

			},
			destroy: function() {
				var index = watchers.indexOf(this),
					self  = this;
				watchers.splice(index, 1);
				for (var i = 0, j = eventTypes.length; i < j; i++) {
					self.callbacks[eventTypes[i]].length = 0;
				}
			},
			// prevent recalculating the element location
			lock: function() {
				this.locked = true;
			},
			unlock: function() {
				this.locked = false;
			}
		};

		var eventHandlerFactory = function (type) {
			return function( callback, isOne ) {
				this.on.call(this, type, callback, isOne);
			};
		};

		for (var i = 0, j = eventTypes.length; i < j; i++) {
			var type =  eventTypes[i];
			ElementWatcher.prototype[type] = eventHandlerFactory(type);
		}

		if (isInBrowser) {
			try {
				calculateViewport();
			} catch (e) {
				try {
					window.$(calculateViewport);
				} catch (e) {
					throw new Error('If you must put scrollMonitor in the <head>, you must use jQuery.');
				}
			}
		}

		function scrollMonitorListener(event) {
			latestEvent = event;
			calculateViewport();
			updateAndTriggerWatchers();
		}

		if (isInBrowser) {
			if (window.addEventListener) {
				window.addEventListener('scroll', scrollMonitorListener);
				window.addEventListener('resize', debouncedRecalcuateAndTrigger);
			} else {
				// Old IE support
				window.attachEvent('onscroll', scrollMonitorListener);
				window.attachEvent('onresize', debouncedRecalcuateAndTrigger);
			}
		}

		root.beget = root.create = function( element, offsets ) {
			if (typeof element === 'string') {
				element = document.querySelector(element);
			} else if (element && element.length > 0) {
				element = element[0];
			}

			var watcher = new ElementWatcher( element, offsets );
			watchers.push(watcher);
			watcher.update();
			return watcher;
		};

		root.update = function() {
			latestEvent = null;
			calculateViewport();
			updateAndTriggerWatchers();
		};
		root.recalculateLocations = function() {
			root.documentHeight = 0;
			root.update();
		};

		return root;
	}

	var exports;
	if (isOnServer) {
		exports = {
			create: function () {},
			createRoot: createRoot
		};
	} else {
		exports = createRoot(document.body);
		exports.createRoot = createRoot;
	}
	return exports;
});