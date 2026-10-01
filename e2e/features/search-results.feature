Feature: Browsing search results
  Search results say how many churches matched, link to each church, and page, map and go back the way a
  reader expects.

  Background:
    Given I am a visitor

  Scenario: The results say how many churches matched
    Given two churches are listed in the same city
    When I look for churches in that city
    Then I am told two churches matched

  Scenario: Each result links to its church and says where it is
    Given a church is listed in the directory
    When I look for that church by name
    Then that church's result links to its page
    And that church's result says where it is

  Scenario: Without my location the results show no distances
    Given a church is listed in the directory
    When I look for that church by name
    Then the results show no distances

  Scenario: Viewing the results on a map
    Given a church is listed in the directory
    And I have looked for that church by name
    When I view the results on a map
    Then I see that church on the map

  Scenario: Opening a church from the results
    Given a church is listed in the directory
    And I have looked for that church by name
    When I open that church from the results
    Then I see that church's page

  Scenario: Turning the page starts me at the top of the next page
    Given more churches are listed than fit on one page
    And I have scrolled to the bottom of the first page
    When I turn to the next page
    Then I am at the top of the next page

  Scenario: Going back keeps my place
    Given more churches are listed than fit on one page
    And I have scrolled to the bottom of the first page
    When I turn to the next page and go back
    Then I am where I was on the first page

  Scenario: Going back after the next page loaded on its own keeps my place
    Given more churches are listed than fit on one page
    And I have scrolled to the bottom of the first page
    When I load the next page directly and go back
    Then I am where I was on the first page

  Scenario: An inactive church is not listed
    Given an inactive church is in the directory
    When I look for that church by name
    Then I am told no church matched
