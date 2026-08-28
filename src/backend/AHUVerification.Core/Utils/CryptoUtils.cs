using System;
using System.IO;
using System.Security.Cryptography;
using System.Text;

namespace AHUVerification.Core.Utils
{
    public static class CryptoUtils
    {
        public static string ComputeSha256(string content) =>
            ComputeSha256(Encoding.UTF8.GetBytes(content));

        public static string ComputeSha256(byte[] bytes)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(bytes)).ToLowerInvariant();
        }

        public static string ComputeSha256(Stream stream)
        {
            using var sha = SHA256.Create();
            return Convert.ToHexString(sha.ComputeHash(stream)).ToLowerInvariant();
        }

        public static string ComputeFileSha256(string filePath)
        {
            using var stream = File.OpenRead(filePath);
            return ComputeSha256(stream);
        }

        public static bool IsValidSha256(string? value)
        {
            if (string.IsNullOrEmpty(value) || value.Length != 64) return false;
            foreach (char c in value)
            {
                if (!Uri.IsHexDigit(c)) return false;
            }
            return true;
        }
    }
}

