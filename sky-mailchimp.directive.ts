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

	skyMailchimp.$inject = ['$http','$timeout','$httpParamSerializerJQLike'];

	function skyMailchimp($http,$timeout,$httpParamSerializerJQLike) {
		var directive = {
			restrict:'A',
			scope:true,
			link:link
		};

		function link (scope,element,attributes) {

			var timer = {};

			element.on('submit', function(event) {
				
				var apiurl = attributes.action || '/umbraco/api/MailChimpSubscriberApi/PostSubscriber';
				
				event.preventDefault();

				$timeout.cancel(timer);

				timer = $timeout(function() {
					/* Do some magic transformRequest-stuff to actually post the data */
					var postFeedback = $http({
						url: apiurl,
						method:'POST',
						data:$httpParamSerializerJQLike(scope.mailchimp),
						headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
					});

					postFeedback.success(function(res) {
						scope.error=false;
						scope.success=true;
					}).error(function(res) {
						scope.success=false;
						if (res && res.meta && res.meta.error) {
							scope.error=res.meta.error;
						} else {
							scope.error='Der er desværre sket en ukendt fejl. Prøv venligst igen senere!';
						}
					});
				},200);

				return false;
			});

		}

		return directive;

	}

})();
