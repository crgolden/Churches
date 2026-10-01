Feature: Suggesting a correction
  A signed-in member suggests a better value for one of a church's details, for a moderator to review.

  Scenario: A member sees the correction form
    Given a church with full details is listed in the directory
    And I am a signed-in member
    When I start a correction for that church
    Then I see the correction form for that church

  Scenario: Submitting a correction
    Given a church with full details is listed in the directory
    And I am a signed-in member
    When I suggest a new street for that church
    Then I am told my suggestion was received

  Scenario: Suggesting a value for a detail the church lacks
    Given a church with only basic details is listed in the directory
    And I am a signed-in member
    When I suggest a phone number for that church
    Then I am told my suggestion was received

  Scenario: Suggesting the value the church already has
    Given a church with full details is listed in the directory
    And I am a signed-in member
    When I suggest that church's current street
    Then I am told the church already has that value
    And no suggestion is received

  Scenario: A visitor is asked to sign in first
    Given a church with full details is listed in the directory
    And I am a visitor
    When I start a correction for that church
    Then I am sent to sign in and brought back to that correction afterwards

  Scenario: A correction for a church that does not exist
    Given I am a signed-in member
    When I start a correction for a church that does not exist
    Then I am taken to the home page
