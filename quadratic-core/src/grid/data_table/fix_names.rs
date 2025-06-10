use crate::grid::{
    TABLE_NAME_FIRST_CHAR_COMPILED, TABLE_NAME_REMAINING_CHARACTERS_COMPILED,
    TABLE_NAME_VALID_CHARS_COMPILED,
};

/// Validates and fixes table names.
pub fn fix_table_name(name: String) -> String {
    let mut result: String;
    if TABLE_NAME_VALID_CHARS_COMPILED.is_match(&name) {
        return name;
    } else {
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
    };
    result
}

pub fn fix_column_name(name: String) -> String {
    name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fix_table_name_valid_names() {
        // Valid names that should pass through unchanged
        assert_eq!(fix_table_name("valid_name".to_string()), "valid_name");
        assert_eq!(fix_table_name("ValidName".to_string()), "ValidName");
        assert_eq!(fix_table_name("_underscore".to_string()), "_underscore");
        assert_eq!(fix_table_name("name123".to_string()), "name123");
        assert_eq!(
            fix_table_name("name_with_underscores".to_string()),
            "name_with_underscores"
        );
        assert_eq!(
            fix_table_name("name.with.dots".to_string()),
            "name.with.dots"
        );
        assert_eq!(fix_table_name("a".to_string()), "a");
        assert_eq!(fix_table_name("A".to_string()), "A");
        assert_eq!(fix_table_name("_".to_string()), "_");
        assert_eq!(
            fix_table_name("CamelCase123_with.dots".to_string()),
            "CamelCase123_with.dots"
        );

        // Test backslash (valid first character according to regex)
        assert_eq!(fix_table_name("\\name".to_string()), "\\name");
    }

    #[test]
    fn test_fix_table_name_invalid_first_character() {
        // Numbers as first character should be replaced with underscore
        assert_eq!(fix_table_name("123name".to_string()), "_23name");
        assert_eq!(fix_table_name("0invalid".to_string()), "_invalid");

        // Special characters as first character should be replaced with underscore
        assert_eq!(fix_table_name("@invalid".to_string()), "_invalid");
        assert_eq!(fix_table_name("#hashtag".to_string()), "_hashtag");
        assert_eq!(fix_table_name("$money".to_string()), "_money");
        assert_eq!(fix_table_name("%percent".to_string()), "_percent");
        assert_eq!(fix_table_name("!exclamation".to_string()), "_exclamation");
        assert_eq!(fix_table_name("-dash".to_string()), "_dash");
        assert_eq!(fix_table_name("+plus".to_string()), "_plus");
        assert_eq!(fix_table_name("=equals".to_string()), "_equals");
        assert_eq!(fix_table_name("(paren".to_string()), "_paren");
        assert_eq!(fix_table_name("[bracket".to_string()), "_bracket");
        assert_eq!(fix_table_name("{brace".to_string()), "_brace");
        assert_eq!(fix_table_name("|pipe".to_string()), "_pipe");
        assert_eq!(fix_table_name("\"quote".to_string()), "_quote");
        assert_eq!(fix_table_name("'apostrophe".to_string()), "_apostrophe");
        assert_eq!(fix_table_name(":colon".to_string()), "_colon");
        assert_eq!(fix_table_name(";semicolon".to_string()), "_semicolon");
        assert_eq!(fix_table_name("<less".to_string()), "_less");
        assert_eq!(fix_table_name(">greater".to_string()), "_greater");
        assert_eq!(fix_table_name("?question".to_string()), "_question");
        assert_eq!(fix_table_name("/slash".to_string()), "_slash");
        assert_eq!(fix_table_name("~tilde".to_string()), "_tilde");
        assert_eq!(fix_table_name("`backtick".to_string()), "_backtick");

        // Space as first character
        assert_eq!(fix_table_name(" space".to_string()), "_space");

        // Tab as first character
        assert_eq!(fix_table_name("\tTab".to_string()), "_Tab");

        // Newline as first character
        assert_eq!(fix_table_name("\nNewline".to_string()), "_Newline");
    }

    #[test]
    fn test_fix_table_name_invalid_remaining_characters() {
        // Valid first character but invalid remaining characters
        assert_eq!(fix_table_name("name@symbol".to_string()), "name_symbol");
        assert_eq!(fix_table_name("name#hash".to_string()), "name_hash");
        assert_eq!(fix_table_name("name$dollar".to_string()), "name_dollar");
        assert_eq!(fix_table_name("name%percent".to_string()), "name_percent");
        assert_eq!(
            fix_table_name("name!exclamation".to_string()),
            "name_exclamation"
        );
        assert_eq!(fix_table_name("name-dash".to_string()), "name_dash");
        assert_eq!(fix_table_name("name+plus".to_string()), "name_plus");
        assert_eq!(fix_table_name("name=equals".to_string()), "name_equals");
        assert_eq!(fix_table_name("name(paren".to_string()), "name_paren");
        assert_eq!(fix_table_name("name[bracket".to_string()), "name_bracket");
        assert_eq!(fix_table_name("name{brace".to_string()), "name_brace");
        assert_eq!(fix_table_name("name|pipe".to_string()), "name_pipe");
        assert_eq!(fix_table_name("name\"quote".to_string()), "name_quote");
        assert_eq!(
            fix_table_name("name'apostrophe".to_string()),
            "name_apostrophe"
        );
        assert_eq!(fix_table_name("name:colon".to_string()), "name_colon");
        assert_eq!(
            fix_table_name("name;semicolon".to_string()),
            "name_semicolon"
        );
        assert_eq!(fix_table_name("name<less".to_string()), "name_less");
        assert_eq!(fix_table_name("name>greater".to_string()), "name_greater");
        assert_eq!(fix_table_name("name?question".to_string()), "name_question");
        assert_eq!(fix_table_name("name/slash".to_string()), "name_slash");
        assert_eq!(fix_table_name("name~tilde".to_string()), "name_tilde");
        assert_eq!(fix_table_name("name`backtick".to_string()), "name_backtick");

        // Multiple invalid characters
        assert_eq!(fix_table_name("name@#$%".to_string()), "name____");
        assert_eq!(
            fix_table_name("name with spaces".to_string()),
            "name_with_spaces"
        );

        // Mixed valid and invalid
        assert_eq!(
            fix_table_name("name_123@test.value".to_string()),
            "name_123_test.value"
        );
    }

    #[test]
    fn test_fix_table_name_both_invalid() {
        // Invalid first character AND invalid remaining characters
        assert_eq!(fix_table_name("123@#$".to_string()), "_23___");
        assert_eq!(
            fix_table_name("@name with spaces".to_string()),
            "_name_with_spaces"
        );
        assert_eq!(fix_table_name("1name@test".to_string()), "_name_test");
        assert_eq!(fix_table_name("$price-value".to_string()), "_price_value");

        // All invalid characters
        assert_eq!(fix_table_name("@#$%^&*()".to_string()), "_________");
    }

    #[test]
    fn test_fix_table_name_edge_cases() {
        // Empty string
        assert_eq!(fix_table_name("".to_string()), "_");

        // Single invalid character
        assert_eq!(fix_table_name("@".to_string()), "_");
        assert_eq!(fix_table_name("1".to_string()), "_");
        assert_eq!(fix_table_name("#".to_string()), "_");

        // Only spaces
        assert_eq!(fix_table_name("   ".to_string()), "___");

        // Only tabs
        assert_eq!(fix_table_name("\t\t".to_string()), "__");

        // Only newlines
        assert_eq!(fix_table_name("\n\n".to_string()), "__");

        // Mixed whitespace
        assert_eq!(fix_table_name(" \t\n".to_string()), "___");

        // Unicode characters (should be replaced)
        assert_eq!(fix_table_name("café".to_string()), "caf_");
        assert_eq!(fix_table_name("naïve".to_string()), "na_ve");
        assert_eq!(fix_table_name("тест".to_string()), "____");

        // Emoji (should be replaced)
        assert_eq!(fix_table_name("name😀test".to_string()), "name_test");

        // Very long name
        let long_name = "a".repeat(1000) + "@" + &"b".repeat(1000);
        let expected = "a".repeat(1000) + "_" + &"b".repeat(1000);
        assert_eq!(fix_table_name(long_name), expected);
    }

    #[test]
    fn test_fix_table_name_backslash_cases() {
        // Test backslash behavior (valid according to regex)
        assert_eq!(fix_table_name("\\valid".to_string()), "\\valid");
        assert_eq!(fix_table_name("name\\path".to_string()), "name\\path");
    }

    #[test]
    fn test_fix_table_name_dot_underscore_combinations() {
        // Test various combinations of dots and underscores (all valid)
        assert_eq!(
            fix_table_name("name.sub.field".to_string()),
            "name.sub.field"
        );
        assert_eq!(
            fix_table_name("name_sub_field".to_string()),
            "name_sub_field"
        );
        assert_eq!(fix_table_name("name._sub".to_string()), "name._sub");
        assert_eq!(fix_table_name("name_.sub".to_string()), "name_.sub");
        assert_eq!(fix_table_name("_name.sub_".to_string()), "_name.sub_");
        assert_eq!(fix_table_name("__..__".to_string()), "__..__");
        assert_eq!(fix_table_name("...".to_string()), "_.."); // First char is invalid
    }
}
