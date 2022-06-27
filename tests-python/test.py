import unittest


class TestTesting(unittest.TestCase):
    def test_testing(self):
        self.assertEqual("foo".upper(), "FOO")


if __name__ == "__main__":
    unittest.main()
