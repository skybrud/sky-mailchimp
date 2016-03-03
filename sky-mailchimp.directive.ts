/* global angular */
(function () {
	'use strict';

	/**
	 * Directive: skyMailchimp
	 * Directive for letting users signup to a mailchimp list
	 *
	 * Just use the directive on your form-tag, and use
	 * ng-model="mailchimp.xxx" on your fields. Use ng-init
	 * to set default- and/or hidden values (eg. newsletterId)
	 *
	**/

	angular.module('skyMailchimp').directive('skyMailchimp',skyMailchimp);

	skyMailchimp.$inject = ['$http', '$timeout', '$httpParamSerializerJQLike'];

	function skyMailchimp($http, $timeout, $httpParamSerializerJQLike) {
		var directive = {
			restrict:'A',
			controller:controller,
			controllerAs:'skyMailchimpCtrl'
		};

		controller.$inject = ['$scope', '$element', '$attrs'];
		function controller($scope, $element, $attrs) {
			var _this=this;
			var timer={};

			_this.mailchimp = {
				mailChimpId:$scope.$eval($attrs.id),
				name:'',
				email:''
			};

			angular.element($element).on('submit', function(e) {
				e.preventDefault();
				
				var apiurl = $attrs.action || '/umbraco/api/MailChimpSubscriberApi/PostSubscriber';
				
				$timeout.cancel(timer);

				timer = $timeout(function() {
					var postFeedback = $http({
						url:apiurl,
						method:'POST',
						data:$httpParamSerializerJQLike(_this.mailchimp),
						headers:{
							'Content-Type':'application/x-www-form-urlencoded'
						}
					});

					postFeedback.success(function(res) {
						_this.error=false;
						_this.success=true;
					}).error(function(res) {
						_this.success=false;
						if (res && res.meta && res.meta.error) {
							_this.error=res.meta.error;
						} else {
							_this.error='Der er desværre sket en ukendt fejl. Prøv venligst igen senere!';
						}
					});
				},200);

				return false;
			});

		}

		return directive;

	}

})();
