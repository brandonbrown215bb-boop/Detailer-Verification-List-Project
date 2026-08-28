using System;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace AHUVerification.Core.Utils
{
    public class FlexibleInt32Converter : JsonConverter<int>
    {
        public override int Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Number)
            {
                if (reader.TryGetInt32(out int i)) return i;
                if (reader.TryGetDouble(out double d)) return (int)Math.Round(d);
            }
            else if (reader.TokenType == JsonTokenType.String)
            {
                string? str = reader.GetString();
                if (int.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out int i)) return i;
                if (double.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out double d))
                    return (int)Math.Round(d);
            }
            return 0;
        }

        public override void Write(Utf8JsonWriter writer, int value, JsonSerializerOptions options)
        {
            writer.WriteNumberValue(value);
        }
    }

    public class FlexibleNullableInt32Converter : JsonConverter<int?>
    {
        public override int? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Null) return null;
            if (reader.TokenType == JsonTokenType.Number)
            {
                if (reader.TryGetInt32(out int i)) return i;
                if (reader.TryGetDouble(out double d)) return (int)Math.Round(d);
            }
            else if (reader.TokenType == JsonTokenType.String)
            {
                string? str = reader.GetString();
                if (string.IsNullOrWhiteSpace(str)) return null;
                if (int.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out int i)) return i;
                if (double.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out double d))
                    return (int)Math.Round(d);
            }
            return null;
        }

        public override void Write(Utf8JsonWriter writer, int? value, JsonSerializerOptions options)
        {
            if (value.HasValue) writer.WriteNumberValue(value.Value);
            else writer.WriteNullValue();
        }
    }

    public class FlexibleDoubleConverter : JsonConverter<double>
    {
        public override double Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
        {
            if (reader.TokenType == JsonTokenType.Number)
            {
                if (reader.TryGetDouble(out double d)) return d;
            }
            else if (reader.TokenType == JsonTokenType.String)
            {
                string? str = reader.GetString();
                if (double.TryParse(str, NumberStyles.Any, CultureInfo.InvariantCulture, out double d))
                    return d;
            }
            return 0.0;
        }

        public override void Write(Utf8JsonWriter writer, double value, JsonSerializerOptions options)
        {
            writer.WriteNumberValue(value);
        }
    }

    public static class JsonDefaults
    {
        public static JsonSerializerOptions CreateFlexibleOptions()
        {
            var options = new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
                NumberHandling = JsonNumberHandling.AllowReadingFromString
            };
            options.Converters.Add(new JsonStringEnumConverter());
            options.Converters.Add(new FlexibleInt32Converter());
            options.Converters.Add(new FlexibleNullableInt32Converter());
            options.Converters.Add(new FlexibleDoubleConverter());
            return options;
        }
    }
}
