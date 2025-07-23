use crate::grid::{
    COLUMN_NAME_FIRST_CHARACTER_COMPILED, COLUMN_NAME_REMAINING_CHARS_COMPILED,
    COLUMN_NAME_VALID_CHARS_COMPILED, MAX_COLUMN_NAME_LENGTH, MAX_TABLE_NAME_LENGTH,
    TABLE_NAME_FIRST_CHAR_COMPILED, TABLE_NAME_REMAINING_CHARACTERS_COMPILED,
    TABLE_NAME_VALID_CHARS_COMPILED,
};

/// Validates and fixes table names.
pub fn sanitize_table_name(name: String) -> String {
    let name = name
        .trim()
        .chars()
        .take(MAX_TABLE_NAME_LENGTH)
        .collect::<String>();
    if name.is_empty() {
        return "Table".to_string();
    }

    let mut result: String;
    if TABLE_NAME_VALID_CHARS_COMPILED.is_match(&name) {
        return name;
    }
    result = String::new();
    // first fix the first character if needed
    if let Some(first_char) = name.chars().next() {
        if TABLE_NAME_FIRST_CHAR_COMPILED.is_match(&first_char.to_string()) {
            result.push(first_char);
        } else {
            result.push('_');
        }
    } else {
        result.push('_');
    };

    // then iterate through the remaining characters and replace failing
    // characters
    for char in name.chars().skip(1) {
        if TABLE_NAME_REMAINING_CHARACTERS_COMPILED.is_match(&char.to_string()) {
            result.push(char);
        } else {
            result.push('_');
        }
    }
    result
}

/// Validates and fixes column names.
pub fn sanitize_column_name(name: String) -> String {
    let name = name
        .trim()
        .chars()
        .take(MAX_COLUMN_NAME_LENGTH)
        .collect::<String>();
    if name.is_empty() {
        return "Column".to_string();
    }

    let mut result: String;
    if COLUMN_NAME_VALID_CHARS_COMPILED.is_match(&name) {
        return name;
    } else {
        result = String::new();
        // first fix the first character if needed
        if let Some(first_char) = name.chars().next() {
            if COLUMN_NAME_FIRST_CHARACTER_COMPILED.is_match(&first_char.to_string()) {
                result.push(first_char);
            } else {
                result.push('_');
            }
        } else {
            result.push('_');
        };

        // then iterate through the remaining characters and replace failing
        // characters
        for char in name.chars().skip(1) {
            if COLUMN_NAME_REMAINING_CHARS_COMPILED.is_match(&char.to_string()) {
                result.push(char);
            } else {
                result.push('_');
            }
        }
    };
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fix_table_name_valid_names() {
        // Valid names that should pass through unchanged
        assert_eq!(sanitize_table_name("valid_name".to_string()), "valid_name");
        assert_eq!(sanitize_table_name("ValidName".to_string()), "ValidName");
        assert_eq!(
            sanitize_table_name("_underscore".to_string()),
            "_underscore"
        );
        assert_eq!(sanitize_table_name("name123".to_string()), "name123");
        assert_eq!(
            sanitize_table_name("name_with_underscores".to_string()),
            "name_with_underscores"
        );
        assert_eq!(
            sanitize_table_name("name.with.dots".to_string()),
            "name.with.dots"
        );
        assert_eq!(sanitize_table_name("a".to_string()), "a");
        assert_eq!(sanitize_table_name("A".to_string()), "A");
        assert_eq!(sanitize_table_name("_".to_string()), "_");
        assert_eq!(
            sanitize_table_name("CamelCase123_with.dots".to_string()),
            "CamelCase123_with.dots"
        );

        // Test backslash (valid first character according to regex)
        assert_eq!(sanitize_table_name("\\name".to_string()), "\\name");
    }

    #[test]
    fn test_fix_table_name_invalid_first_character() {
        // Numbers as first character should be replaced with underscore
        assert_eq!(sanitize_table_name("123name".to_string()), "_23name");
        assert_eq!(sanitize_table_name("0invalid".to_string()), "_invalid");

        // Special characters as first character should be replaced with underscore
        assert_eq!(sanitize_table_name("@invalid".to_string()), "_invalid");
        assert_eq!(sanitize_table_name("#hashtag".to_string()), "_hashtag");
        assert_eq!(sanitize_table_name("$money".to_string()), "_money");
        assert_eq!(sanitize_table_name("%percent".to_string()), "_percent");
        assert_eq!(
            sanitize_table_name("!exclamation".to_string()),
            "_exclamation"
        );
        assert_eq!(sanitize_table_name("-dash".to_string()), "_dash");
        assert_eq!(sanitize_table_name("+plus".to_string()), "_plus");
        assert_eq!(sanitize_table_name("=equals".to_string()), "_equals");
        assert_eq!(sanitize_table_name("(paren".to_string()), "_paren");
        assert_eq!(sanitize_table_name("[bracket".to_string()), "_bracket");
        assert_eq!(sanitize_table_name("{brace".to_string()), "_brace");
        assert_eq!(sanitize_table_name("|pipe".to_string()), "_pipe");
        assert_eq!(sanitize_table_name("\"quote".to_string()), "_quote");
        assert_eq!(
            sanitize_table_name("'apostrophe".to_string()),
            "_apostrophe"
        );
        assert_eq!(sanitize_table_name(":colon".to_string()), "_colon");
        assert_eq!(sanitize_table_name(";semicolon".to_string()), "_semicolon");
        assert_eq!(sanitize_table_name("<less".to_string()), "_less");
        assert_eq!(sanitize_table_name(">greater".to_string()), "_greater");
        assert_eq!(sanitize_table_name("?question".to_string()), "_question");
        assert_eq!(sanitize_table_name("/slash".to_string()), "_slash");
        assert_eq!(sanitize_table_name("~tilde".to_string()), "_tilde");
        assert_eq!(sanitize_table_name("`backtick".to_string()), "_backtick");

        // Space as first character
        assert_eq!(sanitize_table_name(" space".to_string()), "space");

        // Tab as first character
        assert_eq!(sanitize_table_name("\tTab".to_string()), "Tab");

        // Newline as first character
        assert_eq!(sanitize_table_name("\nNewline".to_string()), "Newline");
    }

    #[test]
    fn test_fix_table_name_invalid_remaining_characters() {
        // Valid first character but invalid remaining characters
        assert_eq!(
            sanitize_table_name("name@symbol".to_string()),
            "name_symbol"
        );
        assert_eq!(sanitize_table_name("name#hash".to_string()), "name_hash");
        assert_eq!(
            sanitize_table_name("name$dollar".to_string()),
            "name_dollar"
        );
        assert_eq!(
            sanitize_table_name("name%percent".to_string()),
            "name_percent"
        );
        assert_eq!(
            sanitize_table_name("name!exclamation".to_string()),
            "name_exclamation"
        );
        assert_eq!(sanitize_table_name("name-dash".to_string()), "name_dash");
        assert_eq!(sanitize_table_name("name+plus".to_string()), "name_plus");
        assert_eq!(
            sanitize_table_name("name=equals".to_string()),
            "name_equals"
        );
        assert_eq!(sanitize_table_name("name(paren".to_string()), "name_paren");
        assert_eq!(
            sanitize_table_name("name[bracket".to_string()),
            "name_bracket"
        );
        assert_eq!(sanitize_table_name("name{brace".to_string()), "name_brace");
        assert_eq!(sanitize_table_name("name|pipe".to_string()), "name_pipe");
        assert_eq!(sanitize_table_name("name\"quote".to_string()), "name_quote");
        assert_eq!(
            sanitize_table_name("name'apostrophe".to_string()),
            "name_apostrophe"
        );
        assert_eq!(sanitize_table_name("name:colon".to_string()), "name_colon");
        assert_eq!(
            sanitize_table_name("name;semicolon".to_string()),
            "name_semicolon"
        );
        assert_eq!(sanitize_table_name("name<less".to_string()), "name_less");
        assert_eq!(
            sanitize_table_name("name>greater".to_string()),
            "name_greater"
        );
        assert_eq!(
            sanitize_table_name("name?question".to_string()),
            "name_question"
        );
        assert_eq!(sanitize_table_name("name/slash".to_string()), "name_slash");
        assert_eq!(sanitize_table_name("name~tilde".to_string()), "name_tilde");
        assert_eq!(
            sanitize_table_name("name`backtick".to_string()),
            "name_backtick"
        );

        // Multiple invalid characters
        assert_eq!(sanitize_table_name("name@#$%".to_string()), "name____");
        assert_eq!(
            sanitize_table_name("name with spaces".to_string()),
            "name_with_spaces"
        );

        // Mixed valid and invalid
        assert_eq!(
            sanitize_table_name("name_123@test.value".to_string()),
            "name_123_test.value"
        );
    }

    #[test]
    fn test_fix_table_name_both_invalid() {
        // Invalid first character AND invalid remaining characters
        assert_eq!(sanitize_table_name("123@#$".to_string()), "_23___");
        assert_eq!(
            sanitize_table_name("@name with spaces".to_string()),
            "_name_with_spaces"
        );
        assert_eq!(sanitize_table_name("1name@test".to_string()), "_name_test");
        assert_eq!(
            sanitize_table_name("$price-value".to_string()),
            "_price_value"
        );

        // All invalid characters
        assert_eq!(sanitize_table_name("@#$%^&*()".to_string()), "_________");
    }

    #[test]
    fn test_fix_table_name_edge_cases() {
        // Empty string
        assert_eq!(sanitize_table_name("".to_string()), "Table");

        // Single invalid character
        assert_eq!(sanitize_table_name("@".to_string()), "_");
        assert_eq!(sanitize_table_name("1".to_string()), "_");
        assert_eq!(sanitize_table_name("#".to_string()), "_");

        // Only spaces
        assert_eq!(sanitize_table_name("   ".to_string()), "Table");

        // Only tabs
        assert_eq!(sanitize_table_name("\t\t".to_string()), "Table");

        // Only newlines
        assert_eq!(sanitize_table_name("\n\n".to_string()), "Table");

        // Mixed whitespace
        assert_eq!(sanitize_table_name(" \t\n".to_string()), "Table");

        // Unicode characters
        assert_eq!(sanitize_table_name("café".to_string()), "café");
        assert_eq!(sanitize_table_name("naïve".to_string()), "naïve");
        assert_eq!(sanitize_table_name("тест".to_string()), "тест");

        // Emoji (should be replaced)
        assert_eq!(sanitize_table_name("name😀test".to_string()), "name_test");

        // Very long name
        let long_name = "a".repeat(100) + "@" + &"b".repeat(100);
        let expected = "a".repeat(100) + "_" + &"b".repeat(100);
        assert_eq!(sanitize_table_name(long_name), expected);
    }

    #[test]
    fn test_fix_table_name_backslash_cases() {
        // Test backslash behavior (valid according to regex)
        assert_eq!(sanitize_table_name("\\valid".to_string()), "\\valid");
        assert_eq!(sanitize_table_name("name\\path".to_string()), "name\\path");
    }

    #[test]
    fn test_fix_table_name_dot_underscore_combinations() {
        // Test various combinations of dots and underscores (all valid)
        assert_eq!(
            sanitize_table_name("name.sub.field".to_string()),
            "name.sub.field"
        );
        assert_eq!(
            sanitize_table_name("name_sub_field".to_string()),
            "name_sub_field"
        );
        assert_eq!(sanitize_table_name("name._sub".to_string()), "name._sub");
        assert_eq!(sanitize_table_name("name_.sub".to_string()), "name_.sub");
        assert_eq!(sanitize_table_name("_name.sub_".to_string()), "_name.sub_");
        assert_eq!(sanitize_table_name("__..__".to_string()), "__..__");
        assert_eq!(sanitize_table_name("...".to_string()), "_.."); // First char is invalid
    }

    #[test]
    fn test_column_name_valid_names_unchanged() {
        // Test names that should pass validation unchanged
        assert_eq!(sanitize_column_name("valid_name".to_string()), "valid_name");
        assert_eq!(sanitize_column_name("a".to_string()), "a");
        assert_eq!(sanitize_column_name("A".to_string()), "A");
        assert_eq!(sanitize_column_name("1".to_string()), "1");
        assert_eq!(sanitize_column_name("column_1".to_string()), "column_1");
        assert_eq!(
            sanitize_column_name("Column-Name-123".to_string()),
            "Column-Name-123"
        );
        assert_eq!(sanitize_column_name("_private".to_string()), "_private");
        assert_eq!(sanitize_column_name("camelCase".to_string()), "camelCase");
        assert_eq!(sanitize_column_name("UPPER_CASE".to_string()), "UPPER_CASE");
        assert_eq!(sanitize_column_name("test-name".to_string()), "test-name");
        assert_eq!(
            sanitize_column_name("name_with_123".to_string()),
            "name_with_123"
        );
    }

    #[test]
    fn test_column_name_empty_string() {
        assert_eq!(sanitize_column_name("".to_string()), "Column");
    }

    #[test]
    fn test_column_name_valid_first_characters() {
        // All valid first characters should be preserved
        assert_eq!(sanitize_column_name("a".to_string()), "a");
        assert_eq!(sanitize_column_name("Z".to_string()), "Z");
        assert_eq!(sanitize_column_name("0".to_string()), "0");
        assert_eq!(sanitize_column_name("9".to_string()), "9");
        assert_eq!(sanitize_column_name("_".to_string()), "_");
        assert_eq!(sanitize_column_name("-".to_string()), "-");
    }

    #[test]
    fn test_column_name_invalid_first_character() {
        // Special characters at start should be replaced
        assert_eq!(sanitize_column_name("@column".to_string()), "@column");
        assert_eq!(sanitize_column_name("!important".to_string()), "!important");
        assert_eq!(sanitize_column_name(" spaced".to_string()), "spaced");
        assert_eq!(sanitize_column_name(".hidden".to_string()), ".hidden");
        assert_eq!(sanitize_column_name("(test)".to_string()), "(test)");
        assert_eq!(sanitize_column_name("#hashtag".to_string()), "_hashtag");
        assert_eq!(sanitize_column_name("$price".to_string()), "$price");
        assert_eq!(sanitize_column_name("%percent".to_string()), "%percent");
    }

    #[test]
    fn test_column_name_valid_middle_characters() {
        // Test all valid middle characters are preserved
        assert_eq!(
            sanitize_column_name("a_b-c d.e(f)g".to_string()),
            "a_b-c d.e(f)g"
        );
        assert_eq!(sanitize_column_name("test 123".to_string()), "test 123");
        assert_eq!(
            sanitize_column_name("name.with.dots".to_string()),
            "name.with.dots"
        );
        assert_eq!(
            sanitize_column_name("parentheses(test)".to_string()),
            "parentheses(test)"
        );
        assert_eq!(
            sanitize_column_name("with-dashes".to_string()),
            "with-dashes"
        );
        assert_eq!(
            sanitize_column_name("under_scores".to_string()),
            "under_scores"
        );
    }

    #[test]
    fn test_column_name_invalid_middle_characters() {
        // Invalid middle characters should be replaced with underscores
        assert_eq!(sanitize_column_name("test@email".to_string()), "test@email");
        assert_eq!(sanitize_column_name("price$100".to_string()), "price$100");
        assert_eq!(sanitize_column_name("hash#tag".to_string()), "hash#tag");
        assert_eq!(
            sanitize_column_name("percent%value".to_string()),
            "percent%value"
        );
        assert_eq!(
            sanitize_column_name("ampersand&test".to_string()),
            "ampersand&test"
        );
        assert_eq!(
            sanitize_column_name("question?mark".to_string()),
            "question?mark"
        );
        assert_eq!(
            sanitize_column_name("exclamation!point".to_string()),
            "exclamation!point"
        );
    }

    #[test]
    fn test_column_name_valid_final_characters() {
        // Test valid final characters are preserved
        assert_eq!(sanitize_column_name("end_with_a".to_string()), "end_with_a");
        assert_eq!(sanitize_column_name("end_with_Z".to_string()), "end_with_Z");
        assert_eq!(sanitize_column_name("end_with_1".to_string()), "end_with_1");
        assert_eq!(sanitize_column_name("end_with_9".to_string()), "end_with_9");
        assert_eq!(sanitize_column_name("end_with_".to_string()), "end_with_");
        assert_eq!(sanitize_column_name("end_with-".to_string()), "end_with-");
    }

    #[test]
    fn test_column_name_final_character() {
        // Invalid final characters should be replaced
        assert_eq!(sanitize_column_name("ends_with(".to_string()), "ends_with(");
        assert_eq!(sanitize_column_name("ends_with)".to_string()), "ends_with)");
        assert_eq!(sanitize_column_name("ends_with ".to_string()), "ends_with");
        assert_eq!(sanitize_column_name("ends_with@".to_string()), "ends_with@");
        assert_eq!(sanitize_column_name("ends_with#".to_string()), "ends_with#");
        assert_eq!(sanitize_column_name("ends_with$".to_string()), "ends_with$");
    }

    #[test]
    fn test_column_name_single_character_edge_cases() {
        // Single character names
        assert_eq!(sanitize_column_name("@".to_string()), "@");
        assert_eq!(sanitize_column_name(".".to_string()), ".");
        assert_eq!(sanitize_column_name("(".to_string()), "(");
        assert_eq!(sanitize_column_name(" ".to_string()), "Column");
        assert_eq!(sanitize_column_name("#".to_string()), "_");
    }

    #[test]
    fn test_column_name_multiple_fixes_needed() {
        // Names requiring multiple fixes
        assert_eq!(
            sanitize_column_name("@invalid$middle.".to_string()),
            "@invalid$middle."
        );
        assert_eq!(
            sanitize_column_name("#start middle@".to_string()),
            "_start middle@"
        );
        assert_eq!(
            sanitize_column_name("!test@email.com".to_string()),
            "!test@email.com"
        );
        assert_eq!(sanitize_column_name("$price%20 ".to_string()), "$price%20");
        assert_eq!(sanitize_column_name("123@#$%".to_string()), "123@#$%");
    }

    #[test]
    fn test_column_name_whitespace_handling() {
        // Spaces are valid in middle but not at start/end
        assert_eq!(sanitize_column_name(" test ".to_string()), "test");
        assert_eq!(
            sanitize_column_name("  multiple  spaces".to_string()),
            "multiple  spaces"
        );
        assert_eq!(sanitize_column_name("tab\there".to_string()), "tab_here");
        assert_eq!(
            sanitize_column_name("newline\nhere".to_string()),
            "newline_here"
        );
    }

    #[test]
    fn test_column_name_unicode_and_special_cases() {
        // Unicode and other edge cases
        assert_eq!(sanitize_column_name("café".to_string()), "café");
        assert_eq!(sanitize_column_name("résumé".to_string()), "résumé");
        assert_eq!(sanitize_column_name("naïve".to_string()), "naïve");
        assert_eq!(
            sanitize_column_name("emoji😀test".to_string()),
            "emoji_test"
        );
    }

    #[test]
    fn test_column_name_long_names() {
        // Test longer column names
        assert_eq!(
            sanitize_column_name("this_is_a_very_long_valid_column_name_123".to_string()),
            "this_is_a_very_long_valid_column_name_123"
        );
        assert_eq!(
            sanitize_column_name("@this@has@many@invalid@chars@".to_string()),
            "@this@has@many@invalid@chars@"
        );
    }

    #[test]
    fn test_column_name_consecutive_invalid_chars() {
        // Multiple consecutive invalid characters
        assert_eq!(
            sanitize_column_name("test@@@multiple".to_string()),
            "test@@@multiple"
        );
        assert_eq!(
            sanitize_column_name("start###middle$$$end".to_string()),
            "start###middle$$$end"
        );
        assert_eq!(sanitize_column_name("@@@".to_string()), "@@@");
    }
}
